
document.addEventListener("click", (e) => {
  const actionEl = e.target.closest("a, button, input, textarea, select, label");
  const row = e.target.closest(".row-link");
  if (row && !actionEl) {
    window.location.href = row.dataset.href;
  }
});

document.querySelectorAll(".select-all").forEach((toggle) => {
  toggle.addEventListener("change", () => {
    const table = toggle.closest("table");
    if (!table) return;
    table.querySelectorAll(".row-check").forEach((cb) => cb.checked = toggle.checked);
  });
});
