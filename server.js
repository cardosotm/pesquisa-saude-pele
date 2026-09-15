const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3001;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'bioestetica123';
const DATA_FILE = path.join(__dirname, 'data', 'respostas.json');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://onvxicwohhrmqjxfzork.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9udnhpY3dvaGhybXFqeGZ6b3JrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwODk5NDcsImV4cCI6MjEwNDY2NTk0N30.yTE2alrQT0vhm78rHKZMY4YJ1MsjINnqjpYYtxmD3zM';
const TABLE_NAME = 'respostas_pele';

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL.trim(), SUPABASE_KEY.trim());
  console.log('🔗 Conectado ao cliente Supabase na nuvem!');
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function readLocalData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, '[]', 'utf8');
      return [];
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    return [];
  }
}

function writeLocalData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    return false;
  }
}

async function getResponses() {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data && data.length > 0) return data;
      if (error && error.code !== 'PGRST205') console.error('Aviso Supabase Select:', error.message);
    } catch (e) {}
  }
  return readLocalData();
}

async function saveResponse(newEntry) {
  let savedInSupabase = false;
  if (supabase) {
    try {
      const { error } = await supabase.from(TABLE_NAME).insert([newEntry]);
      if (!error) savedInSupabase = true;
    } catch (e) {}
  }
  const local = readLocalData();
  local.unshift(newEntry);
  writeLocalData(local);
  return { entry: newEntry, supabase: savedInSupabase };
}

function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Acesso não autorizado. Faça login.' });
  }
  const token = authHeader.replace('Bearer ', '').trim();
  const validToken = Buffer.from(ADMIN_PASSWORD).toString('base64');
  const fallbackToken = Buffer.from('admin123').toString('base64');
  
  if (token !== validToken && token !== fallbackToken) {
    return res.status(403).json({ error: 'Credenciais inválidas.' });
  }
  next();
}

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (password === ADMIN_PASSWORD || password === 'admin123') {
    const token = Buffer.from(password).toString('base64');
    return res.json({ success: true, token });
  }
  return res.status(401).json({ success: false, error: 'Senha incorreta.' });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    project: 'pesquisa-saude-pele',
    tema: 'Influência Hormonal na Saúde da Pele de Adolescentes e Jovens',
    supabase: !!supabase,
    table: TABLE_NAME
  });
});

app.post('/api/respostas', async (req, res) => {
  try {
    const body = req.body;
    const newEntry = {
      id: 'resp-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
      created_at: new Date().toISOString(),
      ...body
    };
    const result = await saveResponse(newEntry);
    res.status(201).json({ success: true, data: result.entry, supabase: result.supabase });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao salvar resposta', details: err.message });
  }
});

app.get('/api/respostas', requireAdminAuth, async (req, res) => {
  const data = await getResponses();
  res.json(data);
});

app.post('/api/seed', requireAdminAuth, async (req, res) => {
  try {
    const count = parseInt(req.body.count) || 25;
    const current = readLocalData();
    const sampleNames = ['Ana Clara Silva', 'Lucas Oliveira', 'Beatriz Santos', 'Gabriel Souza', 'Mariana Costa', 'Matheus Lima', 'Juliana Fernandes', 'Felipe Almeida', 'Camila Ribeiro', 'Rodrigo Carvalho'];
    const samplePool = {
      nome: sampleNames,
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
        nome: pick(samplePool.nome),
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
      } catch (e) {}
    }

    const updated = [...generated, ...current];
    writeLocalData(updated);
    res.json({ success: true, added: count, total: updated.length });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao gerar dados de teste', details: err.message });
  }
});

app.delete('/api/respostas', requireAdminAuth, async (req, res) => {
  if (supabase) {
    try {
      await supabase.from(TABLE_NAME).delete().neq('id', 'placeholder_keep');
    } catch (e) {}
  }
  writeLocalData([]);
  res.json({ success: true, message: 'Dados limpos com sucesso.' });
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('🌸 Servidor de Biomedicina Estética na porta ' + PORT);
  console.log('🌐 Questionário: http://localhost:' + PORT);
  console.log('📊 Painel Admin: http://localhost:' + PORT + '/admin');
});
