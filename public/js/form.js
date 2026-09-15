document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('skin-survey-form');
  const progressBar = document.getElementById('progress-bar');
  const stepLabel = document.getElementById('step-label');
  const stepPercent = document.getElementById('step-percent');
  const successScreen = document.getElementById('success-screen');

  let currentStep = 1;
  const totalSteps = 4;

  // Lógica de seleção dos botões de opção
  document.querySelectorAll('.choice-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const field = btn.getAttribute('data-field');
      const val = btn.getAttribute('data-val');
      if (!field || !val) return;

      // Desmarcar irmãos
      document.querySelectorAll(`.choice-card[data-field="${field}"]`).forEach(sibling => {
        sibling.classList.remove('selected');
        const icon = sibling.querySelector('.check-circle i');
        if (icon) icon.classList.add('opacity-0');
      });

      // Marcar o botão clicado
      btn.classList.add('selected');
      const icon = btn.querySelector('.check-circle i');
      if (icon) icon.classList.remove('opacity-0');

      // Preencher o input hidden
      const input = form.querySelector(`input[name="${field}"]`);
      if (input) {
        input.value = val;
        const card = btn.closest('[data-required]');
        if (card) {
          card.classList.remove('border-red-500/80', 'ring-2', 'ring-red-500/30');
        }
      }
    });
  });

  // Navegação entre etapas
  window.goToStep = function(step) {
    if (step > currentStep) {
      if (!validateStep(currentStep)) return;
    }

    // Ocultar todas as etapas
    document.querySelectorAll('.step-pane').forEach(pane => pane.classList.add('hidden'));

    // Exibir a etapa destino
    const target = document.getElementById(`step-${step}`);
    if (target) {
      target.classList.remove('hidden');
      currentStep = step;
      updateProgress();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  function updateProgress() {
    const percent = Math.round((currentStep / totalSteps) * 100);
    progressBar.style.width = `${percent}%`;
    stepLabel.textContent = `Etapa ${currentStep} de ${totalSteps}`;
    stepPercent.textContent = `${percent}%`;
  }

  function validateStep(step) {
    const pane = document.getElementById(`step-${step}`);
    if (!pane) return true;

    const cards = pane.querySelectorAll('[data-required]');
    let allValid = true;
    let firstInvalid = null;

    cards.forEach(card => {
      const fieldName = card.getAttribute('data-required');
      const input = form.querySelector(`input[name="${fieldName}"]`);
      if (!input || !input.value.trim()) {
        allValid = false;
        card.classList.add('border-red-500/80', 'ring-2', 'ring-red-500/30');
        if (!firstInvalid) firstInvalid = card;
      } else {
        card.classList.remove('border-red-500/80', 'ring-2', 'ring-red-500/30');
      }
    });

    if (!allValid && firstInvalid) {
      firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstInvalid.classList.add('animate-pulse');
      setTimeout(() => firstInvalid.classList.remove('animate-pulse'), 1000);
    }

    return allValid;
  }

  // Envio do formulário
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!validateStep(4)) return;

    const submitBtn = document.getElementById('submit-btn');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Gravando respostas...</span>';

    const formData = new FormData(form);
    const payload = {};
    formData.forEach((value, key) => {
      payload[key] = value;
    });

    try {
      const res = await fetch('/api/respostas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Erro ao salvar no servidor local');

      // Exibir tela de sucesso
      form.classList.add('hidden');
      const prog = document.getElementById('progress-bar');
      if (prog && prog.parentElement && prog.parentElement.parentElement) {
        prog.parentElement.parentElement.classList.add('hidden');
      }
      successScreen.classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      alert('Falha ao enviar resposta para o servidor local. Verifique se o servidor está ativo.');
      console.error(err);
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });
});
