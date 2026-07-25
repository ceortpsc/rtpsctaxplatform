(() => {
  const pill = document.getElementById("ws-pill");
  const feed = document.getElementById("event-feed");
  const countEl = document.getElementById("ws-count");
  if (!window.ROSS_WS || !pill) return;

  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${proto}//${location.host}/ws`;
  let attempts = 0;

  function setState(state, label) {
    pill.dataset.state = state;
    pill.textContent = label;
  }

  function pushEvent(evt) {
    if (!feed) return;
    const li = document.createElement("li");
    const code = document.createElement("code");
    code.textContent = evt.type || "event";
    const span = document.createElement("span");
    span.textContent = " " + (evt.message || evt.email || evt.path || "");
    li.append(code, span);
    feed.prepend(li);
    while (feed.children.length > 40) feed.lastElementChild.remove();
  }

  function connect() {
    setState("connecting", "WS · connecting");
    const ws = new WebSocket(url);
    ws.addEventListener("open", () => {
      attempts = 0;
      setState("live", "WS · live");
      ws.send(JSON.stringify({ type: "hello", client: "ross-console" }));
    });
    ws.addEventListener("message", (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data.type === "hello-ack" && typeof data.clients === "number" && countEl) {
          countEl.textContent = String(data.clients);
        }
        if (data.type === "clients" && countEl) {
          countEl.textContent = String(data.clients);
        }
        pushEvent(data);
      } catch (_) {
        /* ignore */
      }
    });
    ws.addEventListener("close", () => {
      setState("down", "WS · reconnecting");
      attempts += 1;
      const wait = Math.min(8000, 400 * 2 ** Math.min(attempts, 4));
      setTimeout(connect, wait);
    });
    ws.addEventListener("error", () => ws.close());
  }

  connect();
})();
