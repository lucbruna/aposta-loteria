export function showProgress(containerId: string, label?: string, onCancel?: () => void): { update: (pct: number) => void; done: () => void; cancel: () => void } {
  const container = document.getElementById(containerId);
  if (!container) return { update: () => {}, done: () => {}, cancel: () => {} };

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'margin:12px 0;padding:12px;background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);';

  const labelRow = document.createElement('div');
  labelRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-size:12px;color:var(--muted);gap:8px;';

  const labelEl = document.createElement('span');
  labelEl.textContent = label || 'Processando...';
  const pctEl = document.createElement('span');
  pctEl.id = `${containerId}-pct`;
  pctEl.textContent = '0%';
  labelRow.appendChild(labelEl);
  labelRow.appendChild(pctEl);
  wrapper.appendChild(labelRow);

  if (onCancel) {
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn';
    cancelBtn.style.cssText = 'padding:4px 10px;font-size:11px;margin-bottom:6px;';
    cancelBtn.textContent = 'Cancelar';
    cancelBtn.onclick = () => { onCancel(); cancelBtn.disabled = true; cancelBtn.textContent = 'Cancelando...'; };
    wrapper.appendChild(cancelBtn);
  }

  const barOuter = document.createElement('div');
  barOuter.style.cssText = 'height:8px;background:var(--panel-2);border-radius:99px;overflow:hidden;';

  const barInner = document.createElement('div');
  barInner.style.cssText = `height:100%;width:0%;background:var(--accent,var(--blue));border-radius:99px;transition:width .15s ease;`;
  barOuter.appendChild(barInner);
  wrapper.appendChild(barOuter);

  container.prepend(wrapper);

  let currentPct = 0;
  let removed = false;

  return {
    update(pct: number) {
      if (removed) return;
      currentPct = Math.min(100, Math.max(0, pct));
      barInner.style.width = `${currentPct}%`;
      pctEl.textContent = `${Math.round(currentPct)}%`;
    },
    done() {
      if (removed) return;
      currentPct = 100;
      barInner.style.width = '100%';
      pctEl.textContent = '100%';
      setTimeout(() => { if (wrapper.parentNode) wrapper.remove(); removed = true; }, 600);
    },
    cancel() {
      if (onCancel) onCancel();
      if (removed) return;
      wrapper.remove();
      removed = true;
    },
  };
}

export function showToast(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
  const toast = document.createElement('div');
  const colors = { info: 'var(--blue)', success: 'var(--green)', error: 'var(--red)' };
  toast.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:999;
    padding:12px 20px;border-radius:var(--radius);
    background:var(--panel);border:1px solid ${colors[type]};
    color:var(--text);font-size:13px;box-shadow:var(--shadow);
    animation: slideIn .3s ease;
    max-width:360px;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity .3s ease, transform .3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(12px)';
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes slideIn { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .6; } }
  .progress-pulse { animation: pulse 1.2s ease-in-out infinite; }
`;
document.head.appendChild(styleSheet);
