document.addEventListener("click", (e) => {
  const actionEl = e.target.closest("a, button, input, textarea, select, label");
  const row = e.target.closest(".row-link");
  if (row && !actionEl) {
    window.location.href = row.dataset.href;
  }
});

function syncTableSelection(table) {
  if (!table) return;
  const rows = [...table.querySelectorAll(".row-check")];
  const selectAll = table.querySelector(".select-all");
  const checked = rows.filter((cb) => cb.checked).length;
  if (selectAll) {
    selectAll.checked = rows.length > 0 && checked === rows.length;
    selectAll.indeterminate = checked > 0 && checked < rows.length;
  }
}

document.querySelectorAll(".select-all").forEach((toggle) => {
  toggle.addEventListener("change", () => {
    const table = toggle.closest("table");
    if (!table) return;
    table.querySelectorAll(".row-check").forEach((cb) => {
      cb.checked = toggle.checked;
    });
    syncTableSelection(table);
  });
});

document.querySelectorAll(".row-check").forEach((cb) => {
  cb.addEventListener("change", () => syncTableSelection(cb.closest("table")));
});

document.querySelectorAll(".js-toggle-select").forEach((btn) => {
  btn.addEventListener("click", () => {
    const panel = btn.closest("[data-dialer-page]") || document;
    const table = panel.querySelector("table");
    if (!table) return;
    const checkboxes = [...table.querySelectorAll(".row-check")];
    const shouldSelect = checkboxes.some((cb) => !cb.checked);
    checkboxes.forEach((cb) => {
      cb.checked = shouldSelect;
    });
    syncTableSelection(table);
  });
});

document.querySelectorAll(".js-choice-group").forEach((group) => {
  const hiddenInput = group.querySelector('input[type="hidden"]');
  group.querySelectorAll(".choice-pill[data-value]").forEach((btn) => {
    btn.addEventListener("click", () => {
      group.querySelectorAll(".choice-pill[data-value]").forEach((item) => item.classList.remove("active"));
      btn.classList.add("active");
      if (hiddenInput) hiddenInput.value = btn.dataset.value || "";
    });
  });
});

document.querySelectorAll(".js-show-add-input").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = document.getElementById(btn.dataset.targetId);
    if (!target) return;
    target.classList.remove("hidden");
    const input = target.querySelector("input");
    if (input) input.focus();
  });
});

document.querySelectorAll(".js-add-option-select").forEach((select) => {
  const toggleTarget = () => {
    const target = document.getElementById(select.dataset.targetId);
    if (!target) return;
    if (select.value === "__add_new__") {
      target.classList.remove("hidden");
      const input = target.querySelector("input");
      if (input) input.focus();
    } else {
      target.classList.add("hidden");
      const input = target.querySelector("input");
      if (input) input.value = "";
    }
  };
  select.addEventListener("change", toggleTarget);
  toggleTarget();
});

(function initDialer() {
  const modal = document.getElementById("batchDialerModal");
  if (!modal) return;

  const nameEl = document.getElementById("dialerCandidateName");
  const metaEl = document.getElementById("dialerCandidateMeta");
  const progressEl = document.getElementById("dialerProgress");
  const numberEl = document.getElementById("dialerCurrentNumber");
  const recruiterEl = document.getElementById("dialerCurrentRecruiter");
  const processEl = document.getElementById("dialerCurrentProcess");
  const callBtn = document.getElementById("dialerCallBtn");
  const nextBtn = document.getElementById("dialerNextBtn");

  let queue = [];
  let currentIndex = 0;

  const getCurrent = () => queue[currentIndex];

  const updateModal = () => {
    const current = getCurrent();
    if (!current) {
      nameEl.textContent = "Queue completed";
      metaEl.textContent = "All selected candidates were processed.";
      progressEl.textContent = "Done";
      numberEl.textContent = "-";
      recruiterEl.textContent = "-";
      processEl.textContent = "-";
      callBtn.disabled = true;
      nextBtn.disabled = true;
      return;
    }

    nameEl.textContent = current.candidateName || "Candidate";
    metaEl.textContent = `Current call: ${current.candidateName || "Candidate"}`;
    progressEl.textContent = `Calling ${currentIndex + 1} of ${queue.length}`;
    numberEl.textContent = current.phone || "-";
    recruiterEl.textContent = current.recruiter || "-";
    processEl.textContent = current.process || "-";
    callBtn.disabled = !current.callUrl;
    nextBtn.disabled = false;
  };

  const openModal = () => {
    modal.hidden = false;
    document.body.classList.add("modal-open");
  };

  const closeModal = () => {
    modal.hidden = true;
    document.body.classList.remove("modal-open");
  };

  document.querySelectorAll("[data-close-dialer]").forEach((el) => {
    el.addEventListener("click", closeModal);
  });

  document.querySelectorAll(".js-start-dialer").forEach((btn) => {
    btn.addEventListener("click", () => {
      const panel = btn.closest("[data-dialer-page]") || document;
      const selectedRows = [...panel.querySelectorAll(".dialer-source-row")].filter((row) => {
        const checkbox = row.querySelector(".row-check");
        return checkbox && checkbox.checked;
      });

      if (!selectedRows.length) {
        alert("Select at least one candidate.");
        return;
      }

      queue = selectedRows.map((row) => ({
        candidateName: row.dataset.candidateName,
        phone: row.dataset.phone,
        recruiter: row.dataset.recruiter,
        process: row.dataset.process,
        callUrl: row.dataset.callUrl,
        whatsappUrl: row.dataset.whatsappUrl,
      }));
      currentIndex = 0;
      updateModal();
      openModal();
    });
  });

  callBtn?.addEventListener("click", () => {
    const current = getCurrent();
    if (!current || !current.callUrl) return;
    window.location.href = current.callUrl;
  });

  nextBtn?.addEventListener("click", () => {
    const current = getCurrent();
    if (!current) return;

    if (current.whatsappUrl) {
      window.open(current.whatsappUrl, "_blank", "noopener,noreferrer");
    }

    currentIndex += 1;
    const next = getCurrent();
    updateModal();
    if (next && next.callUrl) {
      setTimeout(() => {
        window.location.href = next.callUrl;
      }, 120);
    }
  });
})();
