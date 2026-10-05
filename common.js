/* Utilidades compartilhadas entre o painel público e o admin. */
(function () {
  "use strict";
  var cfg = window.SERVA_CONFIG;
  var db = window.supabase.createClient(cfg.url, cfg.key);

  // h("div", {class:"x", onclick: fn}, filho1, "texto", [lista])
  function h(tag, attrs) {
    var el = document.createElement(tag);
    var k;
    if (attrs) {
      for (k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        var v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === "class") el.className = v;
        else if (k.slice(0, 2) === "on" && typeof v === "function") el[k] = v;
        else if (k === "value" || k === "checked" || k === "disabled" || k === "selected") el[k] = v;
        else el.setAttribute(k, v === true ? "" : v);
      }
    }
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

  function fmtData(iso, comAno) {
    if (!iso) return "sem data";
    var p = iso.split("-");
    return p[2] + "/" + p[1] + (comAno ? "/" + p[0] : "");
  }
  function hoje() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function resultado(q) { return q.gols_pro > q.gols_contra ? "V" : q.gols_pro < q.gols_contra ? "D" : "E"; }
  var NOME_RES = { V: "Vitória", E: "Empate", D: "Derrota" };
  function pct(x) { return isFinite(x) ? Math.round(x * 100) + "%" : "–"; }
  function totalPts(r) {
    return r.pts_presenca + r.pts_horario + r.pts_apito + r.pts_aviso + r.pts_gols + r.pts_hat_trick + r.pts_mensalidade + r.pts_ocorrencias;
  }
  // Lança erro se a resposta do Supabase tiver erro; devolve data.
  function ok(res) { if (res.error) throw new Error(res.error.message || String(res.error)); return res.data; }

  window.SERVA = { db: db, cfg: cfg, h: h, clear: clear, fmtData: fmtData, hoje: hoje, resultado: resultado, NOME_RES: NOME_RES, pct: pct, totalPts: totalPts, ok: ok };
})();
