(() => {
  const statusEl = document.getElementById('events-admin-status');
  const panel = document.getElementById('events-admin-panel');
  const list = document.getElementById('events-admin-list');
  const tableHost = document.getElementById('events-admin-table');
  const form = document.getElementById('events-admin-form');

  if (!statusEl || !panel || !list || !tableHost || !form) return;

  const STATUS_OPTIONS = ['draft', 'active', 'closed', 'cancelled'];
  const VISIBILITY_OPTIONS = ['private', 'public'];
  const EDITABLE_FIELDS = ['event_key', 'name', 'event_date', 'venue', 'city', 'status', 'visibility', 'notes'];
  let supabaseClient = null;
  let rows = [];

  const escapeHTML = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const escapeAttr = (value) => escapeHTML(value);
  const fieldValue = (value) => value === null || value === undefined ? '' : String(value);
  const displayValue = (value) => fieldValue(value).trim();

  const getClient = async () => {
    if (window.__hiddenRoomSupabaseClient) return window.__hiddenRoomSupabaseClient;
    if (window.__hiddenRoomSupabaseClientPromise) return window.__hiddenRoomSupabaseClientPromise;
    if (typeof getHiddenRoomSupabaseClient === 'function') return getHiddenRoomSupabaseClient();
    throw new Error('No se pudo iniciar la conexión con Supabase.');
  };

  const setStatus = (message, type = '') => {
    statusEl.hidden = false;
    statusEl.textContent = message;
    statusEl.classList.toggle('db-empty--error', type === 'error');
  };

  const dateLabel = (value) => {
    if (!value) return 'Sin fecha';
    const date = new Date(String(value) + 'T12:00:00');
    return Number.isNaN(date.getTime())
      ? 'Sin fecha'
      : new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  };

  const optionHTML = (options, selected, labels = {}) => options.map((value) => (
    '<option value="' + escapeAttr(value) + '"' + (String(value) === String(selected) ? ' selected' : '') + '>'
      + escapeHTML(labels[value] || value)
      + '</option>'
  )).join('');

  const renderCellInput = (field, value, formId) => {
    const current = fieldValue(value);
    if (field === 'event_date') {
      return '<input class="db-table-input hr-input" form="' + escapeAttr(formId) + '" name="event_date" type="date" value="' + escapeAttr(current) + '">';
    }
    if (field === 'status') {
      return '<select class="db-table-input hr-input" form="' + escapeAttr(formId) + '" name="status">'
        + optionHTML(STATUS_OPTIONS, current || 'active')
        + '</select>';
    }
    if (field === 'visibility') {
      return '<select class="db-table-input hr-input" form="' + escapeAttr(formId) + '" name="visibility">'
        + optionHTML(VISIBILITY_OPTIONS, current || 'private', { private: 'Privado', public: 'Público' })
        + '</select>';
    }
    if (field === 'notes') {
      return '<textarea class="db-table-input hr-input" form="' + escapeAttr(formId) + '" name="notes" rows="2">'
        + escapeHTML(current)
        + '</textarea>';
    }
    return '<input class="db-table-input hr-input" form="' + escapeAttr(formId) + '" name="' + escapeAttr(field) + '" value="' + escapeAttr(current) + '">';
  };

  const rowSearchText = (row) => EDITABLE_FIELDS
    .map((field) => fieldValue(row[field]))
    .join(' ')
    .toLowerCase();

  const renderRows = (items) => {
    if (!items.length) {
      return '<tr class="db-table__empty-row hr-table-empty"><td colspan="9" class="db-empty hr-table-empty">Sin eventos disponibles.</td></tr>';
    }

    return items.map((row, index) => {
      const formId = 'events-admin-row-' + index;
      const original = encodeURIComponent(JSON.stringify(row));
      return '<tr data-events-row data-search-text="' + escapeAttr(rowSearchText(row)) + '">'
        + EDITABLE_FIELDS.map((field) => (
          '<td class="db-table-cell--editable hr-cell-editable">'
            + renderCellInput(field, row[field], formId)
            + '</td>'
        )).join('')
        + '<td class="db-table-cell--actions">'
          + '<form class="db-inline-form" id="' + escapeAttr(formId) + '" data-events-row-form>'
          + '<input type="hidden" name="original" value="' + escapeAttr(original) + '">'
          + '<button class="db-btn-secondary" type="submit">Guardar</button>'
          + '</form>'
        + '</td>'
        + '</tr>';
    }).join('');
  };

  const renderEditor = () => {
    tableHost.innerHTML = ''
      + '<div class="db-toolbar hr-table-toolbar">'
      + '  <label class="db-field db-field--compact db-field--search">'
      + '    <span>Buscar</span>'
      + '    <input data-events-search type="search" placeholder="Buscar evento, lugar o status...">'
      + '    <small data-events-count class="db-field__hint">' + rows.length + ' filas cargadas</small>'
      + '  </label>'
      + '  <button class="db-btn-secondary" type="button" data-events-save-all>GUARDAR</button>'
      + '</div>'
      + '<div class="db-table-wrap hr-table-wrap">'
      + '  <table class="db-table hr-table hr-table-editable db-table--editor" aria-label="Editor de eventos">'
      + '    <thead><tr>'
      + EDITABLE_FIELDS.map((field) => '<th scope="col">' + escapeHTML({
        event_key: 'Clave',
        name: 'Nombre',
        event_date: 'Fecha',
        venue: 'Venue',
        city: 'Ciudad',
        status: 'Status',
        visibility: 'Visibilidad',
        notes: 'Notas',
      }[field] || field) + '</th>').join('')
      + '    <th scope="col">Acciones</th></tr></thead>'
      + '    <tbody data-events-body>' + renderRows(rows) + '</tbody>'
      + '  </table>'
      + '</div>';

    tableHost.querySelector('[data-events-search]')?.addEventListener('input', filterRows);
    tableHost.querySelector('[data-events-save-all]')?.addEventListener('click', saveAll);
    tableHost.querySelectorAll('[data-events-row-form]').forEach((rowForm) => {
      rowForm.addEventListener('submit', (event) => {
        event.preventDefault();
        saveOne(rowForm);
      });
    });
  };

  const filterRows = (event) => {
    const query = String(event.target.value || '').trim().toLowerCase();
    const rowElements = [...tableHost.querySelectorAll('[data-events-row]')];
    let visible = 0;
    rowElements.forEach((row) => {
      const matches = !query || row.dataset.searchText.includes(query);
      row.hidden = !matches;
      if (matches) visible += 1;
    });
    const count = tableHost.querySelector('[data-events-count]');
    if (count) count.textContent = query ? visible + ' resultado' + (visible === 1 ? '' : 's') : rows.length + ' filas cargadas';
  };

  const parseOriginal = (formElement) => {
    try {
      const raw = new FormData(formElement).get('original');
      return JSON.parse(decodeURIComponent(String(raw || '')));
    } catch (error) {
      console.error('[HR] events editor original parse:', error);
      return null;
    }
  };

  const collectChange = (formElement) => {
    const original = parseOriginal(formElement);
    if (!original) return null;
    const values = Object.fromEntries(new FormData(formElement).entries());
    const payload = {};
    const changes = [];

    EDITABLE_FIELDS.forEach((field) => {
      const before = fieldValue(original[field]);
      const after = fieldValue(values[field]);
      if (before === after) return;
      payload[field] = after;
      changes.push({ field, before, after });
    });

    if (!changes.length) return null;
    return { original, payload, changes };
  };

  const normalizePayload = (payload) => ({
    event_key: displayValue(payload.event_key),
    name: displayValue(payload.name),
    event_date: displayValue(payload.event_date) || null,
    venue: displayValue(payload.venue) || null,
    city: displayValue(payload.city) || null,
    status: STATUS_OPTIONS.includes(payload.status) ? payload.status : 'draft',
    visibility: payload.visibility === 'public' ? 'public' : 'private',
    notes: displayValue(payload.notes) || null,
  });

  const savePayload = async (change) => {
    const payload = normalizePayload(change.payload);
    if (!payload.event_key || !payload.name) {
      setStatus('La clave y el nombre son obligatorios.', 'error');
      return false;
    }

    const result = await supabaseClient
      .from('events')
      .update(payload)
      .eq('id', change.original.id);

    if (result.error) {
      console.error('[HR] events editor update:', result.error);
      setStatus(result.error.message || 'No se pudo actualizar el evento.', 'error');
      return false;
    }
    return true;
  };

  const saveOne = async (formElement) => {
    const change = collectChange(formElement);
    if (!change) {
      setStatus('No hay cambios pendientes.', '');
      return;
    }

    const button = formElement.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    try {
      if (await savePayload(change)) {
        setStatus('Evento actualizado correctamente.', 'success');
        await loadEvents();
      }
    } catch (error) {
      console.error('[HR] events editor save:', error);
      setStatus(error?.message || 'No se pudo guardar el evento.', 'error');
    } finally {
      if (button) button.disabled = false;
    }
  };

  const saveAll = async () => {
    const pending = [...tableHost.querySelectorAll('[data-events-row-form]')]
      .map(collectChange)
      .filter(Boolean);

    if (!pending.length) {
      setStatus('No hay cambios pendientes.', '');
      return;
    }

    const summary = pending
      .flatMap((item) => item.changes.map((change) => {
        const label = item.original.name || item.original.event_key || 'Evento';
        return label + ': ' + change.field + ' ' + (change.before || '-') + ' → ' + (change.after || '-');
      }))
      .slice(0, 12)
      .join('\n');

    if (!window.confirm(
      'Vas a guardar ' + pending.length + ' fila' + (pending.length === 1 ? '' : 's')
      + ' con ' + pending.reduce((total, item) => total + item.changes.length, 0)
      + ' cambio' + (pending.reduce((total, item) => total + item.changes.length, 0) === 1 ? '' : 's')
      + ':\n\n' + summary + '\n\n¿Confirmas guardar estos cambios?'
    )) return;

    const button = tableHost.querySelector('[data-events-save-all]');
    if (button) button.disabled = true;
    try {
      for (const change of pending) {
        if (!await savePayload(change)) return;
      }
      setStatus('Cambios guardados correctamente.', 'success');
      await loadEvents();
    } catch (error) {
      console.error('[HR] events editor save all:', error);
      setStatus(error?.message || 'No se pudieron guardar todos los cambios.', 'error');
    } finally {
      if (button) button.disabled = false;
    }
  };

  const loadEvents = async () => {
    const result = await supabaseClient
      .from('events')
      .select('id,event_key,name,event_date,venue,city,status,visibility,notes')
      .order('event_date', { ascending: false, nullsFirst: false });
    if (result.error) throw result.error;
    rows = result.data || [];
    renderEditor();
  };

  const attachCreateForm = () => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form).entries());
      const payload = normalizePayload(values);
      if (!payload.event_key || !payload.name) {
        setStatus('La clave y el nombre son obligatorios.', 'error');
        return;
      }

      const button = form.querySelector('button[type="submit"]');
      if (button) button.disabled = true;
      try {
        const result = await supabaseClient.from('events').insert(payload);
        if (result.error) throw result.error;
        form.reset();
        setStatus('Evento creado correctamente.', 'success');
        await loadEvents();
      } catch (error) {
        console.error('[HR] events admin insert:', error);
        setStatus(error?.message || 'No se pudo crear el evento.', 'error');
      } finally {
        if (button) button.disabled = false;
      }
    });
  };

  (async () => {
    try {
      supabaseClient = await getClient();
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) {
        setStatus('Inicia sesión para acceder al panel de eventos.', 'error');
        return;
      }

      const profile = await supabaseClient
        .from('users')
        .select('roles')
        .eq('id', user.id)
        .maybeSingle();

      if (profile.error) throw profile.error;
      const roles = String(profile.data?.roles || '')
        .split(',')
        .map((role) => role.trim().toLowerCase());

      if (!roles.includes('admin')) {
        setStatus('Este panel es solo para administradores.', 'error');
        return;
      }

      statusEl.hidden = true;
      panel.hidden = false;
      list.hidden = false;
      attachCreateForm();
      await loadEvents();
    } catch (error) {
      console.error('[HR] events admin:', error);
      setStatus('No se pudo cargar el panel de eventos.', 'error');
    }
  })();
})();