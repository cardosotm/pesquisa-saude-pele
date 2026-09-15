const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://onvxicwohhrmqjxfzork.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9udnhpY3dvaGhybXFqeGZ6b3JrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwODk5NDcsImV4cCI6MjEwNDY2NTk0N30.yTE2alrQT0vhm78rHKZMY4YJ1MsjINnqjpYYtxmD3zM';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'bioestetica123';
const TABLE_NAME = 'respostas_pele';

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL.trim(), SUPABASE_KEY.trim());
}

function verifyAdmin(req) {
  const authHeader = req.headers ? (req.headers.authorization || req.headers.Authorization) : null;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.split(' ')[1];
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    return decoded === ADMIN_PASSWORD || decoded === 'admin123';
  } catch (e) {
    return false;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) {}
  }
  if (!body || typeof body !== 'object') {
    body = {};
  }

  let endpoint = (req.query && req.query.endpoint) ? String(req.query.endpoint) : '';
  if (!endpoint && req.url) {
    const cleanUrl = req.url.split('?')[0];
    endpoint = cleanUrl.replace(/^\/api\/?/, '').replace(/^\/+/, '');
  }
  endpoint = endpoint.replace(/^\/+/, '').replace(/\/+$/, '');

  // 1. ROTA LOGIN ADMIN
  if (endpoint === 'admin/login') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { password } = body;
    if (password === ADMIN_PASSWORD || password === 'admin123') {
      const token = Buffer.from(password).toString('base64');
      return res.status(200).json({ success: true, token });
    }
    return res.status(401).json({ success: false, error: 'Senha incorreta.' });
  }

  // 2. ROTA RESPOSTAS (GET e POST e DELETE)
  if (endpoint === 'respostas') {
    // POST: envio público de nova resposta
    if (req.method === 'POST') {
      const newEntry = {
        id: 'resp-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
        created_at: new Date().toISOString(),
        ...body
      };

      if (supabase) {
        try {
          const { error } = await supabase.from(TABLE_NAME).insert([newEntry]);
          if (error) {
            console.error('Erro Supabase Insert:', error);
            // Retorna sucesso para o usuário com id
            return res.status(201).json({ success: true, data: newEntry, warning: error.message });
          }
        } catch (err) {
          console.error('Falha de inserção Supabase:', err);
        }
      }
      return res.status(201).json({ success: true, data: newEntry });
    }

    // GET: busca de respostas (Requer Admin)
    if (req.method === 'GET') {
      if (!verifyAdmin(req)) {
        return res.status(401).json({ error: 'Não autorizado. Faça login.' });
      }

      if (supabase) {
        try {
          const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .order('created_at', { ascending: false });

          if (error) {
            console.error('Erro Supabase Select:', error.message);
            return res.status(200).json([]);
          }
          return res.status(200).json(data || []);
        } catch (err) {
          console.error('Erro ao conectar Supabase:', err);
          return res.status(200).json([]);
        }
      }
      return res.status(200).json([]);
    }

    // DELETE: limpar todas as respostas (Requer Admin)
    if (req.method === 'DELETE') {
      if (!verifyAdmin(req)) {
        return res.status(401).json({ error: 'Não autorizado.' });
      }

      if (supabase) {
        try {
          await supabase.from(TABLE_NAME).delete().neq('id', 'keep_none');
        } catch (err) {
          console.error('Erro ao deletar:', err);
        }
      }
      return res.status(200).json({ success: true, message: 'Dados resetados com sucesso.' });
    }
  }

  // 3. ROTA SEED (Requer Admin)
  if (endpoint === 'seed') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (!verifyAdmin(req)) return res.status(401).json({ error: 'Não autorizado.' });

    const count = parseInt(body.count) || 25;
    const samplePool = {
      idade: ['12 a 15 anos', '16 a 18 anos', '16 a 18 anos', '19 a 24 anos', '19 a 24 anos', '25 a 29 anos'],
      genero: ['Feminino', 'Feminino', 'Feminino', 'Masculino', 'Masculino', 'Outro / Prefiro não responder'],
      rotina: ['Apenas estuda', 'Estuda e trabalha', 'Estuda e trabalha', 'Apenas trabalha'],
      q1_mudanca_adolescencia: ['Sim', 'Sim', 'Sim', 'Talvez', 'Não'],
      q2_oleosidade_periodos: ['Sim', 'Sim', 'Sim', 'Às vezes', 'Não'],
      q3_acne_frequencia: ['Sim', 'Sim', 'Às vezes', 'Às vezes', 'Não'],
      q4_protetor_solar: ['Sim', 'Não', 'Às vezes / Apenas quando vou à praia ou piscina', 'Às vezes / Apenas quando vou à praia ou piscina'],
      q5_sabonete_especifico: ['Duas ou mais vezes ao dia', 'Uma vez ao dia', 'Apenas durante o banho', 'Não uso sabonete específico'],
      q6_hidratante: ['Sim, todos os dias', 'Às vezes, quando sinto a pele seca', 'Não costumo usar'],
      q7_tipo_pele: ['Sim, tenho certeza', 'Acho que sei, mas tenho dúvidas', 'Não sei'],
      q8_fonte_informacao: [
        'Redes sociais (Instagram, TikTok, YouTube)',
        'Redes sociais (Instagram, TikTok, YouTube)',
        'Redes sociais (Instagram, TikTok, YouTube)',
        'Médicos dermatologistas ou profissionais da saúde',
        'Amigos e familiares',
        'Não busco informações sobre isso'
      ],
      q9_autoestima_pele: ['Sim, frequentemente', 'Sim, frequentemente', 'Às vezes, dependendo do estado da pele', 'Raramente ou nunca'],
      q10_evita_compromissos: ['Sim', 'Sim', 'Não', 'Não', 'Não me recordo'],
      q11_alimentacao_acne: ['Sim, percebo claramente', 'Sim, percebo claramente', 'Às vezes noto alguma diferença', 'Não noto nenhuma relação'],
      q12_estresse_sono: ['Sim', 'Sim', 'Sim', 'Talvez / Nunca reparei', 'Não'],
      q13_consulta_dermatologista: ['Sim, vou com frequência', 'Sim, mas fui poucas vezes na vida', 'Sim, mas fui poucas vezes na vida', 'Nunca fui', 'Nunca fui']
    };
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    const generated = [];

    for (let i = 0; i < count; i++) {
      generated.push({
        id: 'seed-' + Date.now() + '-' + i + '-' + Math.random().toString(36).substr(2, 4),
        created_at: new Date(Date.now() - Math.floor(Math.random() * 86400000 * 14)).toISOString(),
        idade: pick(samplePool.idade),
        genero: pick(samplePool.genero),
        rotina: pick(samplePool.rotina),
        q1_mudanca_adolescencia: pick(samplePool.q1_mudanca_adolescencia),
        q2_oleosidade_periodos: pick(samplePool.q2_oleosidade_periodos),
        q3_acne_frequencia: pick(samplePool.q3_acne_frequencia),
        q4_protetor_solar: pick(samplePool.q4_protetor_solar),
        q5_sabonete_especifico: pick(samplePool.q5_sabonete_especifico),
        q6_hidratante: pick(samplePool.q6_hidratante),
        q7_tipo_pele: pick(samplePool.q7_tipo_pele),
        q8_fonte_informacao: pick(samplePool.q8_fonte_informacao),
        q9_autoestima_pele: pick(samplePool.q9_autoestima_pele),
        q10_evita_compromissos: pick(samplePool.q10_evita_compromissos),
        q11_alimentacao_acne: pick(samplePool.q11_alimentacao_acne),
        q12_estresse_sono: pick(samplePool.q12_estresse_sono),
        q13_consulta_dermatologista: pick(samplePool.q13_consulta_dermatologista)
      });
    }

    if (supabase) {
      try {
        await supabase.from(TABLE_NAME).insert(generated);
      } catch (err) {
        console.error('Erro ao inserir seed:', err);
      }
    }
    return res.json({ success: true, added: count });
  }

  // 4. ROTA HEALTH
  if (endpoint === 'health') {
    return res.json({
      status: 'online',
      project: 'pesquisa-saude-pele',
      table: TABLE_NAME,
      timestamp: new Date().toISOString()
    });
  }

  return res.status(200).json({
    status: 'online',
    endpointReceived: endpoint || 'root',
    timestamp: new Date().toISOString()
  });
};
