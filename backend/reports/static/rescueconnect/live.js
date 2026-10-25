/*
  RescueConnect live report updates for the Django admin.

  Near-real-time by polling: every few seconds the page asks /admin/live-reports/ what is new.
  No WebSockets or extra services. Report text is citizen-supplied, so everything is rendered
  with textContent / createElement; this file must never build HTML from strings.
*/
(function () {
    'use strict';

    var script = document.currentScript || document.querySelector('script[data-endpoint]');
    if (!script) { return; }

    var endpoint = script.getAttribute('data-endpoint');
    var listUrl = script.getAttribute('data-list-url') || '';
    var interval = Math.max(3000, parseInt(script.getAttribute('data-interval'), 10) || 8000);

    var KEY_LAST = 'rc_live_last_id';      // newest report id this tab has seen (per tab)
    var KEY_UNSEEN = 'rc_live_unseen';     // new reports not yet looked at (per tab)
    var KEY_SOUND = 'rc_live_sound';       // 'off' disables the alert sound (per browser)
    var MAX_TOASTS = 5;
    var MAX_SINGLE_TOASTS = 3;
    var FLOOD_TOAST_MS = 15000;
    var RECENT_ROWS = 8;

    var toastBox = document.getElementById('rc-toasts');
    var bell = document.getElementById('rc-bell');
    var bellCount = document.getElementById('rc-bell-count');
    var soundButton = document.getElementById('rc-sound');
    var baseTitle = document.title;
    var onReportList = !!listUrl && location.pathname.indexOf(listUrl) === 0 &&
        document.body.classList.contains('change-list');

    var inFlight = false;
    var errors = 0;
    var timer = null;
    var audio = null;
    var newBarCount = 0;

    // ---- storage (can be blocked in private windows) ----
    function read(store, key) {
        try { return window[store].getItem(key); } catch (e) { return null; }
    }
    function write(store, key, value) {
        try { window[store].setItem(key, String(value)); } catch (e) { /* ignore */ }
    }
    function lastId() {
        var raw = read('sessionStorage', KEY_LAST);
        var value = raw === null ? NaN : parseInt(raw, 10);
        return isNaN(value) ? null : value;
    }
    function unseen() { return parseInt(read('sessionStorage', KEY_UNSEEN), 10) || 0; }

    // ---- bell badge and tab title ----
    function renderUnseen() {
        var count = unseen();
        if (bellCount) {
            bellCount.textContent = count > 99 ? '99+' : String(count);
            bellCount.hidden = count === 0;
        }
        if (bell) { bell.classList.toggle('rc-bell--active', count > 0); }
        document.title = (count > 0 ? '(' + count + ') ' : '') + baseTitle;
    }
    function setUnseen(count) {
        write('sessionStorage', KEY_UNSEEN, count);
        renderUnseen();
    }

    // ---- sound ----
    function soundOn() { return read('localStorage', KEY_SOUND) !== 'off'; }
    function renderSound() {
        if (!soundButton) { return; }
        var on = soundOn();
        soundButton.textContent = on ? 'Sound on' : 'Sound off';
        soundButton.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    // Browsers only allow audio after the user has interacted with the page.
    function unlockAudio() {
        try {
            var Context = window.AudioContext || window.webkitAudioContext;
            if (!Context) { return; }
            audio = audio || new Context();
            if (audio.state === 'suspended') { audio.resume(); }
        } catch (e) { /* ignore */ }
    }
    function beep(times) {
        if (!soundOn() || !audio || audio.state !== 'running') { return; }
        try {
            for (var i = 0; i < times; i++) {
                var osc = audio.createOscillator();
                var gain = audio.createGain();
                var start = audio.currentTime + i * 0.25;
                osc.frequency.value = 880;
                gain.gain.setValueAtTime(0.0001, start);
                gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
                osc.connect(gain);
                gain.connect(audio.destination);
                osc.start(start);
                osc.stop(start + 0.2);
            }
        } catch (e) { /* ignore */ }
    }

    // ---- toasts ----
    function safePath(url) {
        return typeof url === 'string' && url.charAt(0) === '/' && url.charAt(1) !== '/';
    }
    function dismiss(toast) {
        if (toast.parentNode) { toast.parentNode.removeChild(toast); }
    }
    function makeToast(kind, title, body, url, persistent, note) {
        if (!toastBox) { return; }
        var toast = document.createElement('div');
        toast.className = 'rc-toast rc-toast--' + kind;
        toast.setAttribute('role', kind === 'urgent' ? 'alert' : 'status');

        var head = document.createElement('div');
        head.className = 'rc-toast__head';
        var heading = document.createElement('strong');
        heading.className = 'rc-toast__title';
        heading.textContent = title;
        var close = document.createElement('button');
        close.type = 'button';
        close.className = 'rc-toast__close';
        close.setAttribute('aria-label', 'Dismiss notification');
        close.textContent = '×';
        close.addEventListener('click', function () { dismiss(toast); });
        head.appendChild(heading);
        head.appendChild(close);
        toast.appendChild(head);

        if (body) {
            var text = document.createElement('p');
            text.className = 'rc-toast__body';
            text.textContent = body;
            toast.appendChild(text);
        }
        if (note) {
            // e.g. the report was saved on the citizen's phone first and arrived late
            var noteEl = document.createElement('p');
            noteEl.className = 'rc-toast__note';
            noteEl.textContent = note;
            toast.appendChild(noteEl);
        }
        if (safePath(url)) {
            var link = document.createElement('a');
            link.className = 'rc-toast__link';
            link.href = url;
            link.textContent = 'Open report';
            toast.appendChild(link);
        }

        toastBox.appendChild(toast);
        // Keep the stack short: drop the oldest non-urgent toasts first.
        while (toastBox.children.length > MAX_TOASTS) {
            var victim = toastBox.querySelector('.rc-toast:not(.rc-toast--urgent)') || toastBox.firstChild;
            dismiss(victim);
        }
        if (!persistent) { setTimeout(function () { dismiss(toast); }, FLOOD_TOAST_MS); }
    }

    // ---- page updates ----
    function updateSummary(summary) {
        if (!summary) { return; }
        var kpis = document.querySelectorAll('[data-rc-kpi]');
        for (var i = 0; i < kpis.length; i++) {
            var key = kpis[i].getAttribute('data-rc-kpi');
            if (summary[key] !== undefined) { kpis[i].textContent = String(summary[key]); }
        }
        var cards = document.querySelectorAll('[data-rc-status]');
        for (var j = 0; j < cards.length; j++) {
            var status = cards[j].getAttribute('data-rc-status');
            if (summary.counts && summary.counts[status] !== undefined) {
                cards[j].textContent = String(summary.counts[status]);
            }
        }
    }

    function addRecentRow(report) {
        var body = document.getElementById('rc-recent-body');
        if (!body || !safePath(report.url) || !/^[a-z]+$/.test(report.status)) { return; }

        var empty = body.querySelector('[data-rc-empty]');
        if (empty) { body.removeChild(empty); }

        var row = document.createElement('tr');
        row.className = 'rc-flash';
        var idCell = document.createElement('th');
        idCell.scope = 'row';
        var idLink = document.createElement('a');
        idLink.href = report.url;
        idLink.textContent = '#' + report.id;
        idCell.appendChild(idLink);
        var typeCell = document.createElement('td');
        typeCell.textContent = report.type;
        var statusCell = document.createElement('td');
        var badge = document.createElement('span');
        badge.className = 'rc-badge rc-badge--' + report.status;
        badge.textContent = report.status_label;
        statusCell.appendChild(badge);
        var timeCell = document.createElement('td');
        timeCell.textContent = report.created_label;
        row.appendChild(idCell);
        row.appendChild(typeCell);
        row.appendChild(statusCell);
        row.appendChild(timeCell);
        body.insertBefore(row, body.firstChild);
        while (body.children.length > RECENT_ROWS) { body.removeChild(body.lastChild); }
    }

    // On the report list, don't reload under the user; offer a refresh instead.
    function showNewBar(count) {
        var content = document.getElementById('content');
        if (!content) { return; }
        newBarCount += count;
        var bar = document.getElementById('rc-newbar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'rc-newbar';
            bar.className = 'rc-newbar';
            bar.setAttribute('role', 'status');
            var message = document.createElement('span');
            message.id = 'rc-newbar-text';
            var refresh = document.createElement('button');
            refresh.type = 'button';
            refresh.textContent = 'Refresh list';
            refresh.addEventListener('click', function () { location.reload(); });
            bar.appendChild(message);
            bar.appendChild(refresh);
            content.insertBefore(bar, content.firstChild);
        }
        document.getElementById('rc-newbar-text').textContent =
            newBarCount + (newBarCount === 1 ? ' new report received.' : ' new reports received.');
    }

    function announce(data) {
        var reports = data.reports;
        var shown = reports.slice(-MAX_SINGLE_TOASTS);
        var anyUrgent = false;

        for (var i = 0; i < reports.length; i++) {
            if (reports[i].urgent) { anyUrgent = true; }
            addRecentRow(reports[i]);
        }
        for (var j = 0; j < shown.length; j++) {
            var report = shown[j];
            makeToast(
                report.urgent ? 'urgent' : 'flood',
                (report.urgent ? 'New urgent response #' : 'New flooded area report #') + report.id,
                report.message,
                report.url,
                report.urgent,
                report.note
            );
        }
        var hidden = data.new_count - shown.length;
        if (hidden > 0) {
            makeToast('flood', hidden + ' more new ' + (hidden === 1 ? 'report' : 'reports'),
                'Open the reports list to review them.', listUrl, false);
        }

        beep(anyUrgent ? 2 : 1);
        if (onReportList) { showNewBar(data.new_count); } else { setUnseen(unseen() + data.new_count); }
    }

    function handle(data) {
        var previous = lastId();
        if (previous === null) {
            // First poll in this tab: remember where we are; do not notify about old reports.
            write('sessionStorage', KEY_LAST, data.latest_id);
        } else if (data.reports && data.reports.length) {
            write('sessionStorage', KEY_LAST, data.latest_id);
            announce(data);
        } else if (data.latest_id < previous) {
            write('sessionStorage', KEY_LAST, data.latest_id); // reports were deleted
        }
        updateSummary(data.summary);
    }

    // ---- polling loop ----
    function schedule() {
        clearTimeout(timer);
        timer = setTimeout(poll, interval * Math.min(1 + errors, 6));
    }

    function poll() {
        if (inFlight) { return; }
        if (document.hidden) { schedule(); return; }
        inFlight = true;
        var last = lastId();
        var url = endpoint + (last !== null ? '?after=' + encodeURIComponent(last) : '');
        fetch(url, { credentials: 'same-origin', cache: 'no-store', headers: { 'Accept': 'application/json' } })
            .then(function (response) {
                var type = response.headers.get('content-type') || '';
                if (!response.ok || type.indexOf('json') === -1) { throw new Error('unavailable'); }
                return response.json();
            })
            .then(function (data) { errors = 0; handle(data); })
            .catch(function () { errors += 1; })
            .then(function () { inFlight = false; schedule(); });
    }

    // ---- start ----
    if (onReportList) { setUnseen(0); }  // the user is looking at the list now
    renderUnseen();
    renderSound();
    if (bell) { bell.addEventListener('click', function () { write('sessionStorage', KEY_UNSEEN, 0); }); }
    if (soundButton) {
        soundButton.addEventListener('click', function () {
            write('localStorage', KEY_SOUND, soundOn() ? 'off' : 'on');
            unlockAudio();
            renderSound();
        });
    }
    ['click', 'keydown', 'touchstart'].forEach(function (name) {
        document.addEventListener(name, unlockAudio, { once: true, passive: true });
    });
    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) { clearTimeout(timer); poll(); }
    });
    poll();
})();
