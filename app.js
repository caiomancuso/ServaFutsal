/* Painel público (somente leitura). */
(function () {
  "use strict";
  var S = window.SERVA, h = S.h, db = S.db;
  var main = document.getElementById("main");
  var tabsEl = document.getElementById("tabs");
  var D = null;
  var aba = "resumo";
  var ordElenco = { col: "gols", dir: -1 };

  var ABAS = [["resumo", "Resumo"], ["elenco", "Elenco"], ["jogos", "Jogos"]];

  function carregar() {
    return Promise.all([
      db.from("partidas").select("id,data,adversario,obs,quadros(quadro,gols_pro,gols_contra)").order("data", { ascending: false }),
      db.from("v_atletas_stats").select("*"),
      db.from("v_pontuacao").select("*"),
      db.from("gols").select("partida_id,atleta_id,quadro,qtd")
    ]).then(function (r) {
      var atletas = S.ok(r[1]);
      var nomes = {};
      atletas.forEach(function (a) { nomes[a.id] = a.nome; });
      D = { partidas: S.ok(r[0]), atletas: atletas, pontos: S.ok(r[2]), gols: S.ok(r[3]), nomes: nomes };
    });
  }

  function quadroDe(p, n) {
    for (var i = 0; i < p.quadros.length; i++) if (p.quadros[i].quadro === n) return p.quadros[i];
    return null;
  }
  function artilheiros(pid, n) {
    return D.gols.filter(function (g) { return g.partida_id === pid && g.quadro === n; })
      .sort(function (a, b) { return b.qtd - a.qtd; })
      .map(function (g) { return D.nomes[g.atleta_id] + (g.qtd > 1 ? " (" + g.qtd + ")" : ""); }).join(", ");
  }

  function statsQuadro(n) {
    var s = { j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, forma: [] };
    D.partidas.forEach(function (p) {
      var q = quadroDe(p, n);
      if (!q) return;
      var r = S.resultado(q);
      s.j++; s[r.toLowerCase()]++; s.gp += q.gols_pro; s.gc += q.gols_contra;
      if (s.forma.length < 5) s.forma.push(r);
    });
    return s;
  }

  function cardQuadro(n) {
    var s = statsQuadro(n);
    var saldo = s.gp - s.gc;
    return h("div", { class: "card" },
      h("h2", null, n + "º Quadro"),
      h("div", { class: "kpis" },
        h("div", { class: "kpi v" }, h("b", null, s.v), h("span", null, "Vitórias")),
        h("div", { class: "kpi" }, h("b", null, s.e), h("span", null, "Empates")),
        h("div", { class: "kpi d" }, h("b", null, s.d), h("span", null, "Derrotas"))),
      h("div", { class: "meta" },
        h("span", null, "Gols ", h("b", null, s.gp + " x " + s.gc)),
        h("span", null, "Saldo ", h("b", null, (saldo > 0 ? "+" : "") + saldo)),
        h("span", { title: "Pontos conquistados ÷ pontos disputados (vitória 3, empate 1)" }, "Aproveitamento ", h("b", null, S.pct((3 * s.v + s.e) / (3 * s.j))))),
      h("div", { class: "form", title: "Últimos jogos, do mais recente para o mais antigo" },
        s.forma.map(function (r) { return h("div", { class: "chip " + r }, r); })));
  }

  function blocoPlacar(p, n) {
    var q = quadroDe(p, n);
    if (!q) return null;
    var r = S.resultado(q), art = artilheiros(p.id, n);
    return h("div", { style: "margin-bottom:14px" },
      h("div", { class: "score" },
        h("div", null, h("div", { class: "ql", style: "font-size:12px;color:var(--muted)" }, n + "º Quadro"),
          h("div", { class: "teams" }, "SERVA x " + p.adversario)),
        h("div", { style: "text-align:right" }, h("div", { class: "n" }, q.gols_pro + " – " + q.gols_contra), h("span", { class: "tag " + r }, S.NOME_RES[r]))),
      art ? h("div", { class: "scorers" }, "Gols: " + art) : null);
  }

  function viewResumo() {
    var ult = D.partidas[0];
    var top = D.atletas.slice().sort(function (a, b) { return b.gols - a.gols; }).slice(0, 5);
    var maxG = top.length ? top[0].gols : 1;
    return [
      h("div", { class: "grid2" }, cardQuadro(1), cardQuadro(2)),
      h("div", { class: "grid2" },
        ult ? h("div", { class: "card" }, h("h2", null, "Último jogo · " + S.fmtData(ult.data)), blocoPlacar(ult, 2), blocoPlacar(ult, 1)) : null,
        h("div", { class: "card" }, h("h2", null, "Artilharia"),
          h("table", null, h("tbody", null, top.map(function (a, i) {
            return h("tr", { class: a.ativo ? null : "out" },
              h("td", null, h("span", { class: "rank" }, i + 1), a.nome),
              h("td", { style: "width:40%" }, h("div", { class: "bar" }, h("i", { style: "width:" + Math.round(100 * a.gols / maxG) + "%" }))),
              h("td", { class: "total" }, a.gols));
          })))))
    ];
  }

  function viewRanking() {
    var rows = D.pontos.map(function (r) { return { r: r, t: S.totalPts(r) }; })
      .filter(function (x) { return x.t !== 0 || x.r.ativo; })
      .sort(function (a, b) { return b.t - a.t || a.r.nome.localeCompare(b.r.nome); });
    var cols = [["pts_presenca", "Presença"], ["pts_horario", "Horário"], ["pts_gols", "Gols"], ["pts_hat_trick", "Hat-trick"], ["pts_apito", "Apito"], ["pts_aviso", "Aviso"], ["pts_mensalidade", "Mensal."], ["pts_ocorrencias", "Ocorr."]];
    return [
      h("div", { class: "card" }, h("h2", null, "Pontuação"),
        h("div", { class: "tablewrap" }, h("table", null,
          h("thead", null, h("tr", null, h("th", null, "Atleta"), h("th", null, "Total"), cols.map(function (c) { return h("th", null, c[1]); }))),
          h("tbody", null, rows.map(function (x, i) {
            return h("tr", { class: x.r.ativo ? null : "out" },
              h("td", null, h("span", { class: "rank" }, i + 1), x.r.nome),
              h("td", { class: "total" }, x.t),
              cols.map(function (c) { var v = x.r[c[0]]; return h("td", { class: v < 0 ? "neg" : null }, v === 0 ? "–" : v); }));
          })))))
    ];
  }

  function viewElenco() {
    var cols = [["nome", "Atleta"], ["presencas", "Jogos"], ["pres", "% Pres."], ["gols", "Gols"], ["gols_q1", "1ºQ"], ["gols_q2", "2ºQ"], ["media", "Média"]];
    var rows = D.atletas.map(function (a) {
      var o = {}; for (var k in a) o[k] = a[k];
      o.pres = a.jogos ? a.presencas / a.jogos : 0;
      o.media = a.presencas ? a.gols / a.presencas : 0;
      return o;
    }).sort(function (a, b) {
      var x = a[ordElenco.col], y = b[ordElenco.col];
      if (typeof x === "string" || typeof y === "string") return ordElenco.dir * String(x || "").localeCompare(String(y || ""));
      return ordElenco.dir * (x - y) || a.nome.localeCompare(b.nome);
    });
    return h("div", { class: "card" }, h("h2", null, "Elenco · " + (rows.length ? rows[0].jogos : 0) + " jogos na temporada"),
      h("div", { class: "tablewrap" }, h("table", null,
        h("thead", null, h("tr", null, cols.map(function (c) {
          return h("th", {
            class: ordElenco.col === c[0] ? "sorted" : null,
            onclick: (function (col) { return function () {
              ordElenco = { col: col, dir: ordElenco.col === col ? -ordElenco.dir : (col === "nome" || col === "posicao" ? 1 : -1) };
              render();
            }; })(c[0])
          }, c[1]);
        }))),
        h("tbody", null, rows.map(function (a) {
          return h("tr", { class: a.ativo ? null : "out" },
            h("td", null, a.nome), h("td", null, a.presencas), h("td", null, S.pct(a.pres)),
            h("td", { class: "total" }, a.gols), h("td", null, a.gols_q1), h("td", null, a.gols_q2),
            h("td", null, a.presencas ? a.media.toFixed(2).replace(".", ",") : "–"));
        })))),
      h("p", { style: "color:var(--muted);font-size:13px;margin:12px 0 0" }, "Nomes riscados: atletas que saíram do time (estatísticas mantidas)."));
  }

  function viewJogos() {
    if (!D.partidas.length) return h("div", { class: "empty" }, "Nenhum jogo lançado.");
    return h("div", { class: "card" }, h("h2", null, "Jogos"), D.partidas.map(function (p) {
      return h("div", { class: "game" },
        h("div", { class: "hd" }, h("b", null, p.adversario), h("span", null, S.fmtData(p.data, true))),
        h("div", { class: "qs" }, [2, 1].map(function (n) {
          var q = quadroDe(p, n);
          if (!q) return h("div", null);
          var r = S.resultado(q), art = artilheiros(p.id, n);
          return h("div", null,
            h("div", { class: "ql" }, n + "º Quadro"),
            h("div", null, h("b", { style: "font-size:18px" }, q.gols_pro + " – " + q.gols_contra), " ", h("span", { class: "tag " + r }, S.NOME_RES[r])),
            art ? h("div", { class: "scorers" }, art) : null);
        })));
    }));
  }

  var VIEWS = { resumo: viewResumo, ranking: viewRanking, elenco: viewElenco, jogos: viewJogos };

  function render() {
    S.clear(tabsEl);
    ABAS.forEach(function (a) {
      tabsEl.appendChild(h("button", {
        class: aba === a[0] ? "on" : null,
        onclick: (function (id) { return function () { aba = id; render(); window.scrollTo(0, 0); }; })(a[0])
      }, a[1]));
    });
    S.clear(main);
    var v = VIEWS[aba]();
    (Array.isArray(v) ? v : [v]).forEach(function (el) { if (el) main.appendChild(el); });
  }

  document.getElementById("sub").textContent = "Temporada " + S.cfg.temporada;
  carregar().then(render).catch(function (e) {
    S.clear(main).appendChild(h("div", { class: "err" }, "Não foi possível carregar os dados: " + e.message));
  });
})();
