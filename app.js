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
  var MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

  function carregar() {
    return Promise.all([
      db.from("partidas").select("id,data,adversario,obs,quadros(quadro,gols_pro,gols_contra)").order("data", { ascending: false }),
      db.from("v_atletas_stats").select("*"),
      db.from("gols").select("partida_id,atleta_id,quadro,qtd")
    ]).then(function (r) {
      var atletas = S.ok(r[1]);
      var nomes = {};
      atletas.forEach(function (a) { nomes[a.id] = a.nome; });
      D = { partidas: S.ok(r[0]), atletas: atletas, gols: S.ok(r[2]), nomes: nomes };
    });
  }

  function quadroDe(p, n) {
    for (var i = 0; i < p.quadros.length; i++) if (p.quadros[i].quadro === n) return p.quadros[i];
    return null;
  }
  function golsDe(pid, n) {
    return D.gols.filter(function (g) { return g.partida_id === pid && g.quadro === n; })
      .sort(function (a, b) { return b.qtd - a.qtd; });
  }
  function chipsGols(pid, n) {
    var gs = golsDe(pid, n);
    if (!gs.length) return null;
    return h("div", { class: "chips" }, gs.map(function (g) {
      return h("span", { class: "gchip" }, D.nomes[g.atleta_id], g.qtd > 1 ? h("b", null, "×" + g.qtd) : null);
    }));
  }
  function dataBadge(iso) {
    var p = iso.split("-");
    return h("div", { class: "dbadge" }, h("b", null, p[2]), h("span", null, MESES[Number(p[1]) - 1]));
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
    var ap = s.j ? (3 * s.v + s.e) / (3 * s.j) : 0;
    return h("section", { class: "card stat" },
      h("h2", null, n + "º Quadro"),
      h("div", { class: "stat-top" },
        h("div", { class: "ring", style: "--p:" + Math.round(ap * 100), title: "Pontos conquistados ÷ pontos disputados (vitória 3, empate 1)" },
          h("div", null, h("b", null, S.pct(ap)), h("span", null, "aprov."))),
        h("div", { class: "ved" },
          h("div", { class: "v" }, h("b", null, s.v), h("span", null, "Vitórias")),
          h("div", { class: "e" }, h("b", null, s.e), h("span", null, "Empates")),
          h("div", { class: "d" }, h("b", null, s.d), h("span", null, "Derrotas")))),
      h("div", { class: "stackbar" },
        h("i", { class: "v", style: "flex-grow:" + s.v }), h("i", { class: "e", style: "flex-grow:" + s.e }), h("i", { class: "d", style: "flex-grow:" + s.d })),
      h("div", { class: "meta" },
        h("span", null, "Gols ", h("b", null, s.gp + " : " + s.gc)),
        h("span", null, "Saldo ", h("b", null, (saldo > 0 ? "+" : "") + saldo)),
        h("span", { class: "form", title: "Últimos jogos, do mais recente para o mais antigo" },
          s.forma.map(function (r) { return h("i", { class: "chip " + r }, r); }))));
  }

  function placar(p, n) {
    var q = quadroDe(p, n);
    if (!q) return null;
    var r = S.resultado(q);
    return h("div", { class: "board " + r },
      h("div", { class: "board-hd" }, h("span", null, n + "º Quadro"), h("span", { class: "tag " + r }, S.NOME_RES[r])),
      h("div", { class: "board-score" },
        h("span", { class: "tm" }, "SERVA"),
        h("div", { class: "nums" }, h("b", null, q.gols_pro), h("i", null, ":"), h("b", { class: "opp" }, q.gols_contra)),
        h("span", { class: "tm opp" }, p.adversario)),
      chipsGols(p.id, n));
  }

  function viewResumo() {
    var ult = D.partidas[0];
    var top = D.atletas.slice().sort(function (a, b) { return b.gols - a.gols; }).slice(0, 5);
    var maxG = top.length && top[0].gols ? top[0].gols : 1;
    return [
      ult ? h("section", { class: "match" },
        h("div", { class: "match-hd" }, dataBadge(ult.data),
          h("div", null, h("span", { class: "kicker" }, "Último jogo"), h("strong", null, "SERVA x " + ult.adversario))),
        h("div", { class: "grid2" }, placar(ult, 2), placar(ult, 1))) : null,
      h("div", { class: "grid2" }, cardQuadro(1), cardQuadro(2)),
      h("section", { class: "card" }, h("h2", null, "Artilharia"),
        h("ol", { class: "scorers" }, top.map(function (a, i) {
          return h("li", { class: (i === 0 ? "lead" : "") + (a.ativo ? "" : " out") },
            h("span", { class: "pos" }, i + 1),
            h("span", { class: "nm" }, a.nome),
            h("span", { class: "bar" }, h("i", { style: "width:" + Math.round(100 * a.gols / maxG) + "%" })),
            h("b", null, a.gols));
        })))
    ];
  }

  function tabelaElenco(ativos, titulo) {
    var cols = [["nome", "Atleta"], ["presencas", "Jogos"], ["pres", "% Pres."], ["gols", "Gols"], ["gols_q1", "1ºQ"], ["gols_q2", "2ºQ"], ["media", "Média"]];
    var rows = D.atletas.filter(function (a) { return a.ativo === ativos; }).map(function (a) {
      var o = {}; for (var k in a) o[k] = a[k];
      o.pres = a.jogos ? a.presencas / a.jogos : 0;
      o.media = a.presencas ? a.gols / a.presencas : 0;
      return o;
    }).sort(function (a, b) {
      var x = a[ordElenco.col], y = b[ordElenco.col];
      if (typeof x === "string" || typeof y === "string") return ordElenco.dir * String(x || "").localeCompare(String(y || ""));
      return ordElenco.dir * (x - y) || a.nome.localeCompare(b.nome);
    });
    if (!rows.length) return null;
    return h("section", { class: "card" + (ativos ? "" : " saiu") }, h("h2", null, titulo, h("em", null, rows.length + " atletas")),
      h("div", { class: "tablewrap" }, h("table", null,
        h("thead", null, h("tr", null, cols.map(function (c) {
          return h("th", {
            class: ordElenco.col === c[0] ? "sorted" : null,
            onclick: (function (col) { return function () {
              ordElenco = { col: col, dir: ordElenco.col === col ? -ordElenco.dir : (col === "nome" ? 1 : -1) };
              render();
            }; })(c[0])
          }, c[1]);
        }))),
        h("tbody", null, rows.map(function (a) {
          return h("tr", null,
            h("td", null, a.nome), h("td", null, a.presencas),
            h("td", null, h("span", { class: "pbar", style: "--p:" + Math.round(a.pres * 100) }, S.pct(a.pres))),
            h("td", { class: "total" }, a.gols), h("td", null, a.gols_q1), h("td", null, a.gols_q2),
            h("td", null, a.presencas ? a.media.toFixed(2).replace(".", ",") : "–"));
        })))));
  }
  function viewElenco() { return [tabelaElenco(true, "Elenco atual"), tabelaElenco(false, "Saíram do elenco")]; }

  function viewJogos() {
    if (!D.partidas.length) return h("div", { class: "empty" }, "Nenhum jogo lançado.");
    return h("section", { class: "card" }, h("h2", null, "Jogos", h("em", null, D.partidas.length + " na temporada")),
      h("div", { class: "games" }, D.partidas.map(function (p) {
        return h("article", { class: "game" }, dataBadge(p.data),
          h("div", { class: "game-body" },
            h("strong", null, p.adversario),
            [2, 1].map(function (n) {
              var q = quadroDe(p, n);
              if (!q) return null;
              var r = S.resultado(q);
              var gs = golsDe(p.id, n).map(function (g) { return D.nomes[g.atleta_id] + (g.qtd > 1 ? " ×" + g.qtd : ""); }).join(", ");
              return h("div", { class: "qline" },
                h("span", { class: "ql" }, n + "ºQ"),
                h("span", { class: "sc " + r }, q.gols_pro + " : " + q.gols_contra),
                h("span", { class: "who" }, gs));
            })));
      })));
  }

  var VIEWS = { resumo: viewResumo, elenco: viewElenco, jogos: viewJogos };

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
