function initializeComponentFeatures() {
  const cards = document.querySelectorAll('.card, .content-card, .guide-card, .trust-card');
  cards.forEach((card) => {
    card.addEventListener('focusin', () => {
      card.style.boxShadow = 'var(--shadow-md)';
    });
    card.addEventListener('focusout', () => {
      card.style.boxShadow = '';
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeComponentFeatures);
} else {
  initializeComponentFeatures();
}
