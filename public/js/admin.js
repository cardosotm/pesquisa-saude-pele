document.addEventListener('DOMContentLoaded', () => {
  let rawData = [];
  let charts = {};

  // Elementos do Login
  const loginModal = document.getElementById('login-modal');
  const adminDashboard = document.getElementById('admin-dashboard');
  const loginForm = document.getElementById('admin-login-form');
  const passwordInput = document.getElementById('admin-password');
  const loginErrorMsg = document.getElementById('login-error-msg');
  const loginErrorText = document.getElementById('login-error-text');
  const btnDoLogin = document.getElementById('btn-do-login');
  const btnLogout = document.getElementById('btn-logout');

  // Elementos do Dashboard
  const kpiTotal = document.getElementById('kpi-total');
  const kpiAcne = document.getElementById('kpi-acne');
  const kpiSunscreen = document.getElementById('kpi-sunscreen');
  const kpiSelfesteem = document.getElementById('kpi-selfesteem');
  const kpiDermato = document.getElementById('kpi-dermato');

  const filterAge = document.getElementById('filter-age');
  const filterGender = document.getElementById('filter-gender');
  const btnResetFilters = document.getElementById('btn-reset-filters');
  const btnSeed = document.getElementById('btn-seed');
  const btnExportCsv = document.getElementById('btn-export-csv');
  const btnClearData = document.getElementById('btn-clear-data');
  const tableBody = document.getElementById('table-body');
  const tableSearch = document.getElementById('table-search');

  // Configuração padrão do Chart.js para Dark Mode
  Chart.defaults.color = '#94a3b8';
  Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.08)';
  Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";

  // Gerenciamento de Token de Sessão
  function getToken() {
    return sessionStorage.getItem('skin_admin_token');
  }

  function setToken(token) {
    sessionStorage.setItem('skin_admin_token', token);
  }

  function clearToken() {
    sessionStorage.removeItem('skin_admin_token');
  }

  function showLogin() {
    loginModal.classList.remove('hidden');
    adminDashboard.classList.add('hidden');
    passwordInput.value = '';
    loginErrorMsg.classList.add('hidden');
    setTimeout(() => passwordInput.focus(), 100);
  }

  function showDashboard() {
    loginModal.classList.add('hidden');
    adminDashboard.classList.remove('hidden');
  }

  // Verificar se já possui sessão salva
  const savedToken = getToken();
  if (savedToken) {
    showDashboard();
    loadData();
  } else {
    showLogin();
  }

  // Handler de Login
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = passwordInput.value.trim();
    if (!password) return;

    btnDoLogin.disabled = true;
    const originalBtn = btnDoLogin.innerHTML;
    btnDoLogin.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Verificando...</span>';
    loginErrorMsg.classList.add('hidden');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setToken(data.token);
        showDashboard();
        await loadData();
      } else {
        loginErrorText.textContent = data.error || 'Senha incorreta. Tente novamente.';
        loginErrorMsg.classList.remove('hidden');
        passwordInput.select();
      }
    } catch (err) {
      loginErrorText.textContent = 'Erro de conexão com o servidor local.';
      loginErrorMsg.classList.remove('hidden');
    } finally {
      btnDoLogin.disabled = false;
      btnDoLogin.innerHTML = originalBtn;
    }
  });

  // Handler de Logout
  btnLogout.addEventListener('click', () => {
    clearToken();
    showLogin();
  });

  // Requisições com Autorização
  function authHeaders() {
    const token = getToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + (token || '')
    };
  }

  // Carregar Dados da API
  async function loadData() {
    try {
      const res = await fetch('/api/respostas', {
        headers: authHeaders()
      });

      if (res.status === 401 || res.status === 403) {
        clearToken();
        showLogin();
        return;
      }

      rawData = await res.json();
      applyFiltersAndRender();
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    }
  }

  // Filtragem
  function applyFiltersAndRender() {
    const ageVal = filterAge.value;
    const genderVal = filterGender.value;

    const filtered = rawData.filter(r => {
      if (ageVal !== 'all' && r.idade !== ageVal) return false;
      if (genderVal !== 'all' && r.genero !== genderVal) return false;
      return true;
    });

    renderKPIs(filtered);
    renderCharts(filtered);
    renderTable(filtered);
  }

  filterAge.addEventListener('change', applyFiltersAndRender);
  filterGender.addEventListener('change', applyFiltersAndRender);

  btnResetFilters.addEventListener('click', () => {
    filterAge.value = 'all';
    filterGender.value = 'all';
    applyFiltersAndRender();
  });

  // Renderização dos KPIs
  function renderKPIs(data) {
    const total = data.length;
    kpiTotal.textContent = total;

    if (total === 0) {
      kpiAcne.textContent = '0%';
      kpiSunscreen.textContent = '0%';
      kpiSelfesteem.textContent = '0%';
      kpiDermato.textContent = '0%';
      return;
    }

    const acneCount = data.filter(r => r.q3_acne_frequencia === 'Sim').length;
    kpiAcne.textContent = Math.round((acneCount / total) * 100) + '%';

    const sunscreenDaily = data.filter(r => r.q4_protetor_solar === 'Sim').length;
    kpiSunscreen.textContent = Math.round((sunscreenDaily / total) * 100) + '%';

    const selfEsteemHigh = data.filter(r => 
      r.q9_autoestima_pele === 'Sim, frequentemente' || 
      r.q9_autoestima_pele === 'Às vezes, dependendo do estado da pele'
    ).length;
    kpiSelfesteem.textContent = Math.round((selfEsteemHigh / total) * 100) + '%';

    const neverDermato = data.filter(r => r.q13_consulta_dermatologista === 'Nunca fui').length;
    kpiDermato.textContent = Math.round((neverDermato / total) * 100) + '%';
  }

  // Renderização dos 8 Gráficos
  function renderCharts(data) {
    // 1. Perfil Demográfico (Idade e Gênero)
    const ages = ['12 a 15 anos', '16 a 18 anos', '19 a 24 anos', '25 a 29 anos', '30 anos ou mais'];
    const ageCounts = ages.map(a => data.filter(r => r.idade === a).length);
    createChart('chart-demographics', 'bar', {
      labels: ages,
      datasets: [{
        label: 'Participantes por Faixa Etária',
        data: ageCounts,
        backgroundColor: ['rgba(244, 114, 182, 0.7)', 'rgba(45, 212, 191, 0.7)', 'rgba(168, 85, 247, 0.7)', 'rgba(251, 191, 36, 0.7)', 'rgba(56, 189, 248, 0.7)'],
        borderRadius: 8
      }]
    });

    // 2. Manifestações Hormonais: Acne vs Oleosidade Periódica
    const acneVals = ['Sim', 'Às vezes', 'Não'];
    const acneCounts = acneVals.map(v => data.filter(r => r.q3_acne_frequencia === v).length);
    const oilCounts = acneVals.map(v => data.filter(r => r.q2_oleosidade_periodos === v).length);
    createChart('chart-hormonal', 'bar', {
      labels: ['Sim', 'Às vezes', 'Não'],
      datasets: [
        {
          label: 'Oleosidade em Alguns Períodos',
          data: oilCounts,
          backgroundColor: 'rgba(45, 212, 191, 0.75)',
          borderRadius: 6
        },
        {
          label: 'Acne com Frequência',
          data: acneCounts,
          backgroundColor: 'rgba(244, 114, 182, 0.75)',
          borderRadius: 6
        }
      ]
    });

    // 3. Hábitos de Skincare (Protetor vs Sabonete vs Hidratante)
    const sunCount = data.filter(r => r.q4_protetor_solar === 'Sim').length;
    const soapCount = data.filter(r => r.q5_sabonete_especifico && !r.q5_sabonete_especifico.includes('Não uso')).length;
    const moistCount = data.filter(r => r.q6_hidratante === 'Sim, todos os dias').length;
    createChart('chart-skincare', 'doughnut', {
      labels: ['Uso Diário Protetor Solar', 'Usa Sabonete Facial Específico', 'Uso Diário Hidratante'],
      datasets: [{
        data: [sunCount, soapCount, moistCount],
        backgroundColor: ['rgba(251, 191, 36, 0.8)', 'rgba(45, 212, 191, 0.8)', 'rgba(244, 114, 182, 0.8)'],
        borderWidth: 2,
        borderColor: '#080c15'
      }]
    });

    // 4. Fontes de Informação
    const sources = [
      'Redes sociais (Instagram, TikTok, YouTube)',
      'Médicos dermatologistas ou profissionais da saúde',
      'Amigos e familiares',
      'Não busco informações sobre isso'
    ];
    const sourceLabels = ['Redes Sociais', 'Dermatologistas / Saúde', 'Amigos / Família', 'Não busca'];
    const sourceCounts = sources.map(s => data.filter(r => r.q8_fonte_informacao === s).length);
    createChart('chart-sources', 'pie', {
      labels: sourceLabels,
      datasets: [{
        data: sourceCounts,
        backgroundColor: ['rgba(168, 85, 247, 0.8)', 'rgba(45, 212, 191, 0.8)', 'rgba(251, 146, 60, 0.8)', 'rgba(100, 116, 139, 0.8)'],
        borderColor: '#080c15'
      }]
    });

    // 5. Impacto na Autoestima e Evitar Compromissos
    const avoidYes = data.filter(r => r.q10_evita_compromissos === 'Sim').length;
    const avoidNo = data.filter(r => r.q10_evita_compromissos === 'Não').length;
    const avoidRec = data.filter(r => r.q10_evita_compromissos === 'Não me recordo').length;
    createChart('chart-selfesteem', 'bar', {
      labels: ['Sim, já evitou sair/fotos', 'Não', 'Não recorda'],
      datasets: [{
        label: 'Evitou Fotos ou Compromissos Devido à Pele',
        data: [avoidYes, avoidNo, avoidRec],
        backgroundColor: ['rgba(244, 63, 94, 0.75)', 'rgba(34, 197, 94, 0.75)', 'rgba(148, 163, 184, 0.75)'],
        borderRadius: 6
      }]
    });

    // 6. Fatores do Estilo de Vida
    const foodClear = data.filter(r => r.q11_alimentacao_acne === 'Sim, percebo claramente').length;
    const foodSometimes = data.filter(r => r.q11_alimentacao_acne === 'Às vezes noto alguma diferença').length;
    const stressYes = data.filter(r => r.q12_estresse_sono === 'Sim').length;
    createChart('chart-lifestyle', 'bar', {
      labels: ['Alimentação Inflamatória (Doces/Fritura)', 'Estresse & Privação de Sono'],
      datasets: [{
        label: 'Reconhecem Impacto Direto na Pele',
        data: [foodClear + foodSometimes, stressYes],
        backgroundColor: ['rgba(245, 158, 11, 0.75)', 'rgba(99, 102, 241, 0.75)'],
        borderRadius: 8
      }]
    });

    // 7. Acesso a Dermatologista
    const dermFrequent = data.filter(r => r.q13_consulta_dermatologista === 'Sim, vou com frequência').length;
    const dermFew = data.filter(r => r.q13_consulta_dermatologista === 'Sim, mas fui poucas vezes na vida').length;
    const dermNever = data.filter(r => r.q13_consulta_dermatologista === 'Nunca fui').length;
    createChart('chart-treatment', 'doughnut', {
      labels: ['Vai com frequência', 'Poucas vezes na vida', 'Nunca consultou'],
      datasets: [{
        data: [dermFrequent, dermFew, dermNever],
        backgroundColor: ['rgba(16, 185, 129, 0.8)', 'rgba(59, 130, 246, 0.8)', 'rgba(239, 68, 68, 0.8)'],
        borderColor: '#080c15'
      }]
    });

    // 8. Cruzamento Clínico: Sabe o Tipo de Pele vs Usa Sabonete Específico
    const knowsSkin = data.filter(r => r.q7_tipo_pele === 'Sim, tenho certeza');
    const doubtsSkin = data.filter(r => r.q7_tipo_pele === 'Acho que sei, mas tenho dúvidas');
    const dontKnowSkin = data.filter(r => r.q7_tipo_pele === 'Não sei');

    const soapInKnows = knowsSkin.filter(r => r.q5_sabonete_especifico && r.q5_sabonete_especifico.includes('vezes ao dia')).length;
    const soapInDoubts = doubtsSkin.filter(r => r.q5_sabonete_especifico && r.q5_sabonete_especifico.includes('vezes ao dia')).length;
    const soapInDont = dontKnowSkin.filter(r => r.q5_sabonete_especifico && r.q5_sabonete_especifico.includes('vezes ao dia')).length;

    createChart('chart-correlation', 'bar', {
      labels: ['Tem Certeza do Tipo', 'Tem Dúvidas', 'Não Sabe o Tipo'],
      datasets: [
        {
          label: 'Total no Grupo',
          data: [knowsSkin.length, doubtsSkin.length, dontKnowSkin.length],
          backgroundColor: 'rgba(148, 163, 184, 0.4)',
          borderRadius: 6
        },
        {
          label: 'Higienizam com Sabonete Específico (1+ ao dia)',
          data: [soapInKnows, soapInDoubts, soapInDont],
          backgroundColor: 'rgba(45, 212, 191, 0.8)',
          borderRadius: 6
        }
      ]
    });
  }

  function createChart(canvasId, type, data, options = {}) {
    if (charts[canvasId]) {
      charts[canvasId].destroy();
    }
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    charts[canvasId] = new Chart(ctx, {
      type: type,
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 12, padding: 12, font: { size: 11 } }
          }
        },
        scales: type === 'bar' ? {
          y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
          x: { grid: { display: false } }
        } : {},
        ...options
      }
    });
  }

  // Renderizar Tabela
  function renderTable(data) {
    const q = (tableSearch.value || '').toLowerCase().trim();
    const rows = data.filter(r => {
      if (!q) return true;
      return (
        (r.nome || '').toLowerCase().includes(q) ||
        (r.idade || '').toLowerCase().includes(q) ||
        (r.genero || '').toLowerCase().includes(q) ||
        (r.q3_acne_frequencia || '').toLowerCase().includes(q) ||
        (r.q4_protetor_solar || '').toLowerCase().includes(q)
      );
    });

    if (rows.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="8" class="text-center py-6 text-slate-500">Nenhum registro encontrado.</td></tr>';
      return;
    }

    tableBody.innerHTML = rows.map(r => {
      const date = r.created_at ? new Date(r.created_at).toLocaleDateString('pt-BR') : '-';
      return `
        <tr class="hover:bg-white/5 transition">
          <td class="p-3 text-slate-400 font-sans">${date}</td>
          <td class="p-3 font-semibold text-white font-sans">${r.nome || "Anonimo"}</td>
          <td class="p-3 font-semibold text-white font-sans">${r.idade || '-'}</td>
          <td class="p-3 text-slate-300 font-sans">${r.genero || '-'}</td>
          <td class="p-3 font-sans">${badge(r.q1_mudanca_adolescencia)}</td>
          <td class="p-3 font-sans">${badge(r.q3_acne_frequencia)}</td>
          <td class="p-3 font-sans">${badge(r.q4_protetor_solar)}</td>
          <td class="p-3 font-sans">${badge(r.q9_autoestima_pele)}</td>
          <td class="p-3 text-slate-400 font-sans">${r.q13_consulta_dermatologista || '-'}</td>
        </tr>
      `;
    }).join('');
  }

  function badge(val) {
    if (!val) return '-';
    if (val === 'Sim' || val.startsWith('Sim')) {
      return `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30">${val}</span>`;
    }
    if (val === 'Não') {
      return `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500/20 text-slate-300 border border-slate-500/30">${val}</span>`;
    }
    return `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">${val}</span>`;
  }

  tableSearch.addEventListener('input', () => {
    applyFiltersAndRender();
  });

  // Gerar 25 respostas de amostra (com token de autenticação)
  btnSeed.addEventListener('click', async () => {
    btnSeed.disabled = true;
    btnSeed.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Gerando...</span>';
    try {
      const res = await fetch('/api/seed', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ count: 25 })
      });
      const data = await res.json();
      if (data.success) {
        await loadData();
      } else if (res.status === 401 || res.status === 403) {
        clearToken();
        showLogin();
      }
    } catch (err) {
      alert('Erro ao gerar dados de amostra.');
    } finally {
      btnSeed.disabled = false;
      btnSeed.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles text-pink-400"></i><span class="hidden sm:inline">+25 Amostras</span>';
    }
  });

  // Limpar dados locais (com token de autenticação)
  btnClearData.addEventListener('click', async () => {
    if (!confirm('Deseja realmente apagar todos os dados coletados localmente?')) return;
    try {
      const res = await fetch('/api/respostas', { 
        method: 'DELETE',
        headers: authHeaders()
      });
      if (res.status === 401 || res.status === 403) {
        clearToken();
        showLogin();
        return;
      }
      await loadData();
    } catch (err) {
      alert('Erro ao limpar dados.');
    }
  });

  // Exportar para CSV
  btnExportCsv.addEventListener('click', () => {
    if (rawData.length === 0) {
      alert('Nenhum dado disponível para exportar.');
      return;
    }

    const headers = [
      'ID', 'Data', 'Nome', 'Idade', 'Genero', 'Rotina',
      'Q1_Mudanca_Adolescencia', 'Q2_Oleosidade_Periodos', 'Q3_Acne_Frequencia',
      'Q4_Protetor_Solar', 'Q5_Sabonete_Especifico', 'Q6_Hidratante',
      'Q7_Tipo_Pele', 'Q8_Fonte_Informacao', 'Q9_Autoestima_Pele',
      'Q10_Evita_Compromissos', 'Q11_Alimentacao_Acne', 'Q12_Estresse_Sono',
      'Q13_Consulta_Dermatologista'
    ];

    const csvRows = [headers.join(';')];

    rawData.forEach(r => {
      const row = [
        r.id || '',
        r.created_at || '',
        `"${(r.nome || '').replace(/"/g, '""')}"`,
        `"${(r.idade || '').replace(/"/g, '""')}"`,
        `"${(r.genero || '').replace(/"/g, '""')}"`,
        `"${(r.rotina || '').replace(/"/g, '""')}"`,
        `"${(r.q1_mudanca_adolescencia || '').replace(/"/g, '""')}"`,
        `"${(r.q2_oleosidade_periodos || '').replace(/"/g, '""')}"`,
        `"${(r.q3_acne_frequencia || '').replace(/"/g, '""')}"`,
        `"${(r.q4_protetor_solar || '').replace(/"/g, '""')}"`,
        `"${(r.q5_sabonete_especifico || '').replace(/"/g, '""')}"`,
        `"${(r.q6_hidratante || '').replace(/"/g, '""')}"`,
        `"${(r.q7_tipo_pele || '').replace(/"/g, '""')}"`,
        `"${(r.q8_fonte_informacao || '').replace(/"/g, '""')}"`,
        `"${(r.q9_autoestima_pele || '').replace(/"/g, '""')}"`,
        `"${(r.q10_evita_compromissos || '').replace(/"/g, '""')}"`,
        `"${(r.q11_alimentacao_acne || '').replace(/"/g, '""')}"`,
        `"${(r.q12_estresse_sono || '').replace(/"/g, '""')}"`,
        `"${(r.q13_consulta_dermatologista || '').replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(';'));
    });

    const blob = new Blob([csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pesquisa_biomedicina_estetica_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
});
