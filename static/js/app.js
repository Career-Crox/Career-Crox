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

(function initSortableFormGrids() {
  document.querySelectorAll(".js-sortable-grid").forEach((grid) => {
    const storageKey = grid.dataset.storageKey;
    const cards = [...grid.children].filter((item) => item.dataset.sortKey);
    if (!cards.length || !storageKey) return;

    const applySavedOrder = () => {
      let saved = [];
      try {
        saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
      } catch (error) {
        saved = [];
      }
      if (!saved.length) return;
      const map = new Map(cards.map((item) => [item.dataset.sortKey, item]));
      saved.forEach((key) => {
        const item = map.get(key);
        if (item) {
          grid.appendChild(item);
          map.delete(key);
        }
      });
      map.forEach((item) => grid.appendChild(item));
    };

    const saveOrder = () => {
      const order = [...grid.children].map((item) => item.dataset.sortKey).filter(Boolean);
      localStorage.setItem(storageKey, JSON.stringify(order));
    };

    applySavedOrder();

    let dragged = null;
    [...grid.children].forEach((item) => {
      if (!item.dataset.sortKey) return;
      item.draggable = true;
      item.classList.add("form-card-item");
      if (!item.querySelector(".form-card-handle")) {
        const handle = document.createElement("div");
        handle.className = "form-card-handle";
        handle.textContent = "⋮⋮";
        item.prepend(handle);
      }
      item.addEventListener("dragstart", () => {
        dragged = item;
        item.classList.add("is-dragging");
      });
      item.addEventListener("dragend", () => {
        item.classList.remove("is-dragging");
        dragged = null;
        saveOrder();
      });
      item.addEventListener("dragover", (event) => {
        event.preventDefault();
      });
      item.addEventListener("drop", (event) => {
        event.preventDefault();
        if (!dragged || dragged === item) return;
        const children = [...grid.children];
        const dragIndex = children.indexOf(dragged);
        const dropIndex = children.indexOf(item);
        if (dragIndex < dropIndex) {
          grid.insertBefore(dragged, item.nextSibling);
        } else {
          grid.insertBefore(dragged, item);
        }
        saveOrder();
      });
    });
  });
})();

(function initDialer() {
  const modal = document.getElementById("batchDialerModal");
  if (!modal) return;

  const nameEl = document.getElementById("dialerCandidateName");
  const metaEl = document.getElementById("dialerCandidateMeta");
  const progressEl = document.getElementById("dialerProgress");
  const phoneEl = document.getElementById("dialerMetaPhone");
  const recruiterEl = document.getElementById("dialerMetaRecruiter");
  const processEl = document.getElementById("dialerMetaProcess");
  const callBtn = document.getElementById("dialerCallBtn");
  const nextBtn = document.getElementById("dialerNextBtn");
  const openProfileBtn = document.getElementById("dialerOpenProfileBtn");
  const saveStatusBtn = document.getElementById("dialerSaveStatusBtn");
  const saveNoteBtn = document.getElementById("dialerSaveNoteBtn");
  const saveFollowupBtn = document.getElementById("dialerSaveFollowupBtn");
  const noteInput = document.getElementById("dialerNoteInput");
  const followupInput = document.getElementById("dialerFollowupInput");

  let queue = [];
  let currentIndex = 0;

  const getCurrent = () => queue[currentIndex];

  const formatFollowupValue = (value) => {
    if (!value) return "";
    return value.replace(" ", "T").slice(0, 16);
  };

  const setProgress = (message, tone = "") => {
    progressEl.textContent = message;
    progressEl.dataset.tone = tone;
  };

  const syncQuickChoiceGroups = (current) => {
    modal.querySelectorAll(".js-quick-choice").forEach((group) => {
      const field = group.dataset.field;
      const value = current ? (current[field] || "") : "";
      group.querySelectorAll(".choice-pill[data-value]").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.value === value);
      });
    });
  };

  const updateRowPreview = (current) => {
    if (!current || !current.rowEl) return;
    current.rowEl.dataset.callConnected = current.call_connected || "";
    current.rowEl.dataset.jobInterest = current.job_interest || "";
    current.rowEl.dataset.interviewAvailability = current.interview_availability || "";
    current.rowEl.dataset.followupAt = current.followup_at || "";

    const followupCell = current.rowEl.querySelector("td:nth-child(7)");
    if (followupCell) {
      followupCell.textContent = current.followup_at || "-";
    }

    const followupMeta = current.rowEl.querySelector(".candidate-followup");
    if (current.followup_at) {
      if (followupMeta) {
        followupMeta.textContent = `Follow-up: ${current.followup_at}`;
      } else {
        const meta = document.createElement("div");
        meta.className = "candidate-followup";
        meta.textContent = `Follow-up: ${current.followup_at}`;
        current.rowEl.querySelector(".candidate-cell")?.appendChild(meta);
      }
    } else if (followupMeta) {
      followupMeta.remove();
    }
  };

  const updateModal = () => {
    const current = getCurrent();
    if (!current) {
      nameEl.textContent = "Queue completed";
      metaEl.textContent = "All selected candidates were processed.";
      setProgress("Done", "success");
      phoneEl.textContent = "Phone: -";
      recruiterEl.textContent = "Recruiter: -";
      processEl.textContent = "Process: -";
      noteInput.value = "";
      followupInput.value = "";
      syncQuickChoiceGroups(null);
      callBtn.disabled = true;
      nextBtn.disabled = true;
      openProfileBtn.disabled = true;
      return;
    }

    nameEl.textContent = current.candidateName || "Candidate";
    metaEl.textContent = `Current queue item: ${current.candidateName || "Candidate"}`;
    setProgress(`Calling ${currentIndex + 1} of ${queue.length}`);
    phoneEl.textContent = `Phone: ${current.phone || "-"}`;
    recruiterEl.textContent = `Recruiter: ${current.recruiter || "-"}`;
    processEl.textContent = `Process: ${current.process || "-"}`;
    noteInput.value = "";
    followupInput.value = formatFollowupValue(current.followup_at || "");
    syncQuickChoiceGroups(current);
    callBtn.disabled = !current.callUrl;
    nextBtn.disabled = false;
    openProfileBtn.disabled = !current.profileUrl;
  };

  const openModal = () => {
    modal.hidden = false;
    document.body.classList.add("modal-open");
  };

  const closeModal = () => {
    modal.hidden = true;
    document.body.classList.remove("modal-open");
  };

  const postQuickUpdate = async (payload, successMessage) => {
    const current = getCurrent();
    if (!current || !current.profileId) return;
    try {
      const response = await fetch(`/api/profile/${current.profileId}/quick-update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        setProgress(data.message || "Update failed.", "error");
        return;
      }
      if (payload.call_connected !== undefined) current.call_connected = payload.call_connected;
      if (payload.job_interest !== undefined) current.job_interest = payload.job_interest;
      if (payload.interview_availability !== undefined) current.interview_availability = payload.interview_availability;
      if (payload.followup_at !== undefined) current.followup_at = data.followup_at || payload.followup_at || "";
      updateRowPreview(current);
      if (payload.note_text) noteInput.value = "";
      setProgress(successMessage, "success");
    } catch (error) {
      setProgress("Network issue while saving the update.", "error");
    }
  };

  modal.querySelectorAll(".js-quick-choice").forEach((group) => {
    const field = group.dataset.field;
    group.querySelectorAll(".choice-pill[data-value]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const current = getCurrent();
        if (!current) return;
        current[field] = btn.dataset.value || "";
        syncQuickChoiceGroups(current);
      });
    });
  });

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
        rowEl: row,
        profileId: row.dataset.profileId,
        profileUrl: row.dataset.profileUrl,
        candidateName: row.dataset.candidateName,
        phone: row.dataset.phone,
        recruiter: row.dataset.recruiter,
        process: row.dataset.process,
        callUrl: row.dataset.callUrl,
        whatsappUrl: row.dataset.whatsappUrl,
        call_connected: row.dataset.callConnected,
        job_interest: row.dataset.jobInterest,
        interview_availability: row.dataset.interviewAvailability,
        followup_at: row.dataset.followupAt,
      }));
      currentIndex = 0;
      updateModal();
      openModal();
    });
  });

  openProfileBtn?.addEventListener("click", () => {
    const current = getCurrent();
    if (!current || !current.profileUrl) return;
    window.open(current.profileUrl, "_blank", "noopener");
  });

  callBtn?.addEventListener("click", () => {
    const current = getCurrent();
    if (!current || !current.callUrl) return;
    window.location.href = current.callUrl;
  });

  saveStatusBtn?.addEventListener("click", async () => {
    const current = getCurrent();
    if (!current) return;
    await postQuickUpdate({
      call_connected: current.call_connected || "",
      job_interest: current.job_interest || "",
      interview_availability: current.interview_availability || "",
    }, "Status updated.");
  });

  saveNoteBtn?.addEventListener("click", async () => {
    const noteText = (noteInput.value || "").trim();
    if (!noteText) {
      setProgress("Add a note first.", "warning");
      return;
    }
    await postQuickUpdate({ note_text: noteText }, "Note added to history.");
  });

  saveFollowupBtn?.addEventListener("click", async () => {
    if (!followupInput.value) {
      setProgress("Pick a follow-up date and time.", "warning");
      return;
    }
    await postQuickUpdate({ followup_at: followupInput.value }, "Follow-up scheduled.");
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

(function initProfileQuickPanel() {
  const panel = document.querySelector('[data-profile-quick-panel]');
  if (!panel) return;

  const profileId = panel.dataset.profileId;
  const progressEl = document.getElementById('profileQuickProgress');
  const noteInput = document.getElementById('profileQuickNoteInput');
  const followupInput = document.getElementById('profileQuickFollowupInput');
  const statusBtn = panel.querySelector('.js-profile-status-save');
  const noteBtn = panel.querySelector('.js-profile-note-save');
  const followupBtn = panel.querySelector('.js-profile-followup-save');

  const state = {
    call_connected: panel.querySelector('.js-quick-choice[data-field="call_connected"] .choice-pill.active')?.dataset.value || '',
    job_interest: panel.querySelector('.js-quick-choice[data-field="job_interest"] .choice-pill.active')?.dataset.value || '',
    interview_availability: panel.querySelector('.js-quick-choice[data-field="interview_availability"] .choice-pill.active')?.dataset.value || '',
  };

  const setProgress = (message, tone = '') => {
    progressEl.textContent = message;
    progressEl.dataset.tone = tone;
  };

  panel.querySelectorAll('.js-quick-choice').forEach((group) => {
    const field = group.dataset.field;
    group.querySelectorAll('.choice-pill[data-value]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state[field] = btn.dataset.value || '';
        group.querySelectorAll('.choice-pill[data-value]').forEach((node) => {
          node.classList.toggle('active', node === btn);
        });
      });
    });
  });

  const postQuickUpdate = async (payload, successMessage) => {
    try {
      const response = await fetch(`/api/profile/${profileId}/quick-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        setProgress(data.message || 'Update failed.', 'error');
        return;
      }
      if (payload.note_text) noteInput.value = '';
      setProgress(successMessage, 'success');
      if (payload.followup_at !== undefined) {
        setTimeout(() => window.location.reload(), 350);
      }
    } catch (error) {
      setProgress('Network issue while saving the update.', 'error');
    }
  };

  statusBtn?.addEventListener('click', async () => {
    await postQuickUpdate({
      call_connected: state.call_connected || '',
      job_interest: state.job_interest || '',
      interview_availability: state.interview_availability || '',
    }, 'Status updated.');
  });

  noteBtn?.addEventListener('click', async () => {
    const noteText = (noteInput.value || '').trim();
    if (!noteText) {
      setProgress('Add a note first.', 'warning');
      return;
    }
    await postQuickUpdate({ note_text: noteText }, 'Note added to history.');
  });

  followupBtn?.addEventListener('click', async () => {
    if (!followupInput.value) {
      setProgress('Pick a follow-up date and time.', 'warning');
      return;
    }
    await postQuickUpdate({ followup_at: followupInput.value }, 'Follow-up saved.');
  });
})();
