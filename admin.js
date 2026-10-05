/* Área administrativa: login + lançamentos. A permissão real é aplicada no banco (RLS). */
(function () {
  "use strict";
  var S = window.SERVA, h = S.h, db = S.db;
  var main = document.getElementById("main");
  var tabsEl = document.getElementById("tabs");
  var sub = document.getElementById("sub");

  var aba = "jogo";
  var D = { atletas: [], partidas: [], regras: [], pendencias: [] };
  var aviso = null; // {tipo:"ok"|"err"|"warn", texto}
  var F = null;     // formulário do jogo em edição
  var mesSel = S.hoje().slice(0, 7);

  var ABAS = [["jogo", "Lançar jogo"], ["jogos", "Jogos"], ["atletas", "Atletas"], ["ocorr", "Ocorrências"], ["mensal", "Mensalidades"]];

  function msg(tipo, texto) { aviso = { tipo: tipo, texto: texto }; }
  // Mostra o erro sem recarregar a tela (evita laço se a rede estiver fora).
  function falha(e) {
    aviso = null;
    main.insertBefore(h("div", { class: "err" }, "Erro: " + (e && e.message ? e.message : e)), main.firstChild);
    window.scrollTo(0, 0);
  }

  /* ---------- login ---------- */
  function telaLogin(erro) {
    S.clear(tabsEl); sub.textContent = "";
    var email = h("input", { type: "email", autocomplete: "username", placeholder: "seu@email.com" });
    var senha = h("input", { type: "password", autocomplete: "current-password", placeholder: "Senha" });
    function entrar() {
      db.auth.signInWithPassword({ email: email.value.trim(), password: senha.value }).then(function (r) {
        if (r.error) telaLogin("Não foi possível entrar: " + r.error.message); else iniciar();
      });
    }
    S.clear(main).appendChild(h("div", { class: "card", style: "max-width:420px;margin:30px auto" },
      h("h2", null, "Entrar"),
      erro ? h("div", { class: "err" }, erro) : null,
      h("label", { class: "f" }, "E-mail", email),
      h("label", { class: "f" }, "Senha", senha),
      h("button", { class: "btn primary", style: "width:100%", onclick: entrar }, "Entrar")));
    senha.onkeydown = function (e) { if (e.key === "Enter") entrar(); };
  }

  function iniciar() {
    db.auth.getSession().then(function (r) {
      var sess = r.data && r.data.session;
      if (!sess) { telaLogin(); return; }
      db.from("admins").select("email").then(function (a) {
        if (a.error || !a.data || !a.data.length) {
          S.clear(tabsEl);
          S.clear(main).appendChild(h("div", { class: "card" },
            h("div", { class: "err" }, "A conta " + sess.user.email + " não tem permissão de administrador."),
            h("button", { class: "btn", onclick: sair }, "Sair")));
          return;
        }
        sub.textContent = sess.user.email;
        recarregar().then(function () { novoForm(null); render(); }).catch(falha);
      });
    });
  }
  function sair() { db.auth.signOut().then(function () { telaLogin(); }); }

  function recarregar() {
    return Promise.all([
      db.from("atletas").select("*").order("nome"),
      db.from("partidas").select("id,data,adversario,obs,quadros(*)").order("data", { ascending: false }),
      db.from("regras_pontos").select("*").order("ordem"),
      db.from("v_pendencias").select("*").order("data")
    ]).then(function (r) {
      D.atletas = S.ok(r[0]); D.partidas = S.ok(r[1]); D.regras = S.ok(r[2]); D.pendencias = S.ok(r[3]);
    });
  }

  /* ---------- formulário do jogo ---------- */
  function linhaVazia(a) {
    return { atleta: a, presente: false, no_horario: null, avisou: false, apitos: 0, g1: 0, g2: 0 };
  }
  function novoForm(partida, part, gols) {
    F = {
      id: partida ? partida.id : null,
      data: partida ? partida.data : S.hoje(),
      adversario: partida ? partida.adversario : "",
      obs: partida && partida.obs ? partida.obs : "",
      q: { 1: { gp: "", gc: "", ca: 0, cv: 0 }, 2: { gp: "", gc: "", ca: 0, cv: 0 } },
      linhas: [], golsOriginais: gols || []
    };
    if (partida) {
      partida.quadros.forEach(function (q) {
        F.q[q.quadro] = { gp: q.gols_pro, gc: q.gols_contra, ca: q.cartoes_amarelos, cv: q.cartoes_vermelhos };
      });
    }
    var porAtleta = {};
    (part || []).forEach(function (p) { porAtleta[p.atleta_id] = p; });
    var golsDe = {};
    (gols || []).forEach(function (g) { golsDe[g.atleta_id + ":" + g.quadro] = g.qtd; });
    D.atletas.forEach(function (a) {
      var p = porAtleta[a.id];
      var temGol = golsDe[a.id + ":1"] || golsDe[a.id + ":2"];
      if (!a.ativo && !p && !temGol) return; // quem saiu só aparece em jogos onde tem registro
      var l = linhaVazia(a);
      if (p) { l.presente = p.presente; l.no_horario = p.no_horario; l.avisou = !!p.avisou_ausencia; l.apitos = p.quadros_apitados; }
      l.g1 = golsDe[a.id + ":1"] || 0; l.g2 = golsDe[a.id + ":2"] || 0;
      F.linhas.push(l);
    });
  }

  function abrirPartida(p) {
    Promise.all([
      db.from("participacao").select("*").eq("partida_id", p.id),
      db.from("gols").select("*").eq("partida_id", p.id)
    ]).then(function (r) {
      novoForm(p, S.ok(r[0]), S.ok(r[1]));
      aba = "jogo"; aviso = null; render(); window.scrollTo(0, 0);
    }).catch(falha);
  }

  function somaGols(n) {
    return F.linhas.reduce(function (s, l) { return s + (n === 1 ? l.g1 : l.g2); }, 0);
  }
  function num(v) { return v === "" || v === null || isNaN(Number(v)) ? null : Number(v); }

  function problemasForm() {
    var erros = [], alertas = [];
    if (!F.data) erros.push("Informe a data.");
    if (!F.adversario.trim()) erros.push("Informe o adversário.");
    [2, 1].forEach(function (n) {
      var gp = num(F.q[n].gp), gc = num(F.q[n].gc);
      if (gp === null || gc === null || gp < 0 || gc < 0) { erros.push("Informe o placar do " + n + "º quadro."); return; }
      var s = somaGols(n);
      if (s > gp) erros.push(n + "º quadro: " + s + " gols lançados para os atletas, mas o placar tem " + gp + ".");
      else if (s < gp) alertas.push(n + "º quadro: faltam " + (gp - s) + " gol(s) sem autor (gol contra do adversário?).");
    });
    F.linhas.forEach(function (l) {
      if (!l.presente && (l.g1 || l.g2 || l.apitos)) erros.push(l.atleta.nome + " tem gol ou apito lançado, mas está ausente.");
    });
    if (!F.linhas.some(function (l) { return l.presente; })) alertas.push("Nenhum atleta marcado como presente.");
    return { erros: erros, alertas: alertas };
  }

  function salvar() {
    var pr = problemasForm();
    if (pr.erros.length) { msg("err", pr.erros.join(" ")); render(); window.scrollTo(0, 0); return; }
    if (pr.alertas.length && !window.confirm("Atenção:\n- " + pr.alertas.join("\n- ") + "\n\nSalvar mesmo assim?")) return;
    var base = { data: F.data, adversario: F.adversario.trim(), obs: F.obs.trim() || null };
    var passo = F.id
      ? db.from("partidas").update(base).eq("id", F.id).select("id").single()
      : db.from("partidas").insert(base).select("id").single();
    var pid;
    passo.then(function (r) {
      pid = S.ok(r).id; F.id = pid;
      return db.from("quadros").upsert([1, 2].map(function (n) {
        return { partida_id: pid, quadro: n, gols_pro: num(F.q[n].gp), gols_contra: num(F.q[n].gc), cartoes_amarelos: num(F.q[n].ca) || 0, cartoes_vermelhos: num(F.q[n].cv) || 0 };
      }));
    }).then(function (r) {
      S.ok(r);
      return db.from("participacao").upsert(F.linhas.map(function (l) {
        return { partida_id: pid, atleta_id: l.atleta.id, presente: l.presente, no_horario: l.presente ? l.no_horario : null, avisou_ausencia: l.presente ? null : l.avisou, quadros_apitados: l.presente ? l.apitos : 0 };
      }));
    }).then(function (r) {
      S.ok(r);
      var novos = [];
      F.linhas.forEach(function (l) {
        if (l.g1 > 0) novos.push({ partida_id: pid, atleta_id: l.atleta.id, quadro: 1, qtd: l.g1 });
        if (l.g2 > 0) novos.push({ partida_id: pid, atleta_id: l.atleta.id, quadro: 2, qtd: l.g2 });
      });
      return novos.length ? db.from("gols").upsert(novos).then(function (x) { S.ok(x); return novos; }) : novos;
    }).then(function (novos) {
      // remove gols que existiam e foram zerados
      var mantidos = {};
      novos.forEach(function (g) { mantidos[g.atleta_id + ":" + g.quadro] = true; });
      var remover = F.golsOriginais.filter(function (g) { return !mantidos[g.atleta_id + ":" + g.quadro]; });
      return Promise.all(remover.map(function (g) {
        return db.from("gols").delete().eq("partida_id", pid).eq("atleta_id", g.atleta_id).eq("quadro", g.quadro).then(S.ok);
      }));
    }).then(function () {
      return recarregar();
    }).then(function () {
      msg("ok", "Jogo contra " + base.adversario + " salvo.");
      novoForm(null); render(); window.scrollTo(0, 0);
    }).catch(function (e) {
      msg("err", "Erro ao salvar (" + (e.message || e) + "). Os dados continuam no formulário: toque em Salvar de novo.");
      render(); window.scrollTo(0, 0);
    });
  }

  function excluirPartida(p) {
    if (!window.confirm("Excluir o jogo contra " + p.adversario + " (" + S.fmtData(p.data, true) + ")? Gols e presenças desse jogo serão apagados.")) return;
    db.from("partidas").delete().eq("id", p.id).then(function (r) {
      S.ok(r); return recarregar();
    }).then(function () { msg("ok", "Jogo excluído."); if (F && F.id === p.id) novoForm(null); render(); }).catch(falha);
  }

  function stepper(rotulo, get, set, max) {
    var out = h("output", null, get());
    function mudar(d) { return function () { var v = Math.max(0, Math.min(max, get() + d)); set(v); out.textContent = v; atualizarChecks(); }; }
    return h("span", { class: "step" }, rotulo, h("button", { type: "button", onclick: mudar(-1), "aria-label": "menos" }, "−"), out, h("button", { type: "button", onclick: mudar(1), "aria-label": "mais" }, "+"));
  }

  var checks = {};
  function atualizarChecks() {
    [1, 2].forEach(function (n) {
      var el = checks[n]; if (!el) return;
      var gp = num(F.q[n].gp), s = somaGols(n);
      if (gp === null) { el.className = "check"; el.textContent = "Gols lançados: " + s; return; }
      el.className = "check " + (s === gp ? "good" : s > gp ? "bad" : "");
      el.textContent = "Gols lançados: " + s + " de " + gp + (s === gp ? " ✓" : s > gp ? " (passou do placar)" : "");
    });
  }

  function caixaQuadro(n) {
    function campo(k, attrs) {
      var i = h("input", Object.assign({ type: "number", min: "0", inputmode: "numeric", value: F.q[n][k] }, attrs || {}));
      i.oninput = function () { F.q[n][k] = i.value; atualizarChecks(); };
      return i;
    }
    checks[n] = h("div", { class: "check" });
    return h("div", { class: "qbox" },
      h("h3", null, n + "º Quadro"),
      h("div", { class: "placar" }, h("span", null, "SERVA"), campo("gp", { "aria-label": "Gols pró" }), h("span", null, "x"), campo("gc", { "aria-label": "Gols contra" })),
      checks[n],
      h("div", { class: "row", style: "margin-top:10px" },
        h("label", { class: "f", style: "margin:0" }, "Amarelos", campo("ca")),
        h("label", { class: "f", style: "margin:0" }, "Vermelhos", campo("cv"))));
  }

  function linhaAtleta(l) {
    var box = h("div", { class: "ath" + (l.presente ? "" : " off") });
    function desenhar() {
      S.clear(box);
      box.className = "ath" + (l.presente ? "" : " off");
      var bt = h("button", { type: "button", class: "toggle" + (l.presente ? " on" : ""), onclick: function () { l.presente = !l.presente; if (!l.presente) { l.g1 = 0; l.g2 = 0; l.apitos = 0; l.no_horario = null; } desenhar(); atualizarChecks(); } }, l.presente ? "Presente" : "Ausente");
      box.appendChild(h("div", { class: "line" },
        h("div", { class: "name" }, l.atleta.nome, h("small", null, (l.atleta.posicao || "") + (l.atleta.ativo ? "" : " · saiu do time"))), bt));
      if (l.presente) {
        function hor(v, txt, cls) {
          return h("button", { type: "button", class: "toggle" + (l.no_horario === v ? " " + cls : ""), onclick: function () { l.no_horario = l.no_horario === v ? null : v; desenhar(); } }, txt);
        }
        box.appendChild(h("div", { class: "extra" },
          stepper("Gols 2ºQ", function () { return l.g2; }, function (v) { l.g2 = v; }, 30),
          stepper("Gols 1ºQ", function () { return l.g1; }, function (v) { l.g1 = v; }, 30),
          stepper("Apitou", function () { return l.apitos; }, function (v) { l.apitos = v; }, 2),
          h("span", { class: "seg" }, "Horário", hor(true, "No horário", "on"), hor(false, "Atrasou", "no"))));
      } else {
        var cb = h("input", { type: "checkbox", checked: l.avisou });
        cb.onchange = function () { l.avisou = cb.checked; };
        box.appendChild(h("div", { class: "extra" }, h("label", { class: "seg" }, cb, "Avisou a ausência até quinta")));
      }
    }
    desenhar();
    return box;
  }

  function viewJogo() {
    var data = h("input", { type: "date", value: F.data });
    data.oninput = function () { F.data = data.value; };
    var adv = h("input", { type: "text", value: F.adversario, list: "advs", placeholder: "Nome do adversário", autocomplete: "off" });
    adv.oninput = function () { F.adversario = adv.value; };
    var obs = h("input", { type: "text", value: F.obs, placeholder: "Opcional" });
    obs.oninput = function () { F.obs = obs.value; };
    var vistos = {};
    var lista = h("datalist", { id: "advs" }, D.partidas.filter(function (p) { if (vistos[p.adversario]) return false; vistos[p.adversario] = 1; return true; }).map(function (p) { return h("option", { value: p.adversario }); }));
    var out = [
      h("div", { class: "card" },
        h("h2", null, F.id ? "Editando jogo" : "Novo jogo"),
        h("div", { class: "row" }, h("label", { class: "f" }, "Data", data), h("label", { class: "f" }, "Adversário", adv, lista)),
        h("label", { class: "f" }, "Observação", obs),
        h("div", { class: "grid2" }, caixaQuadro(2), caixaQuadro(1))),
      h("div", { class: "card" }, h("h2", null, "Atletas"), F.linhas.map(linhaAtleta)),
      h("div", { class: "sticky-save" },
        h("button", { class: "btn primary", onclick: salvar }, F.id ? "Salvar alterações" : "Salvar jogo"),
        F.id ? h("button", { class: "btn", onclick: function () { novoForm(null); aviso = null; render(); } }, "Cancelar") : null)
    ];
    setTimeout(atualizarChecks, 0);
    return out;
  }

  function viewJogos() {
    var pend = {};
    D.pendencias.forEach(function (x) { (pend[x.partida_id] = pend[x.partida_id] || []).push(x.quadro + "ºQ: " + x.problema); });
    return [
      D.pendencias.length ? h("div", { class: "warn" }, D.pendencias.length + " pendência(s) de dados para revisar nos jogos marcados abaixo.") : null,
      h("div", { class: "card" }, h("h2", null, D.partidas.length + " jogos"),
        D.partidas.map(function (p) {
          var placar = [2, 1].map(function (n) {
            var q = p.quadros.filter(function (x) { return x.quadro === n; })[0];
            return q ? n + "ºQ " + q.gols_pro + "x" + q.gols_contra : "";
          }).join(" · ");
          return h("div", { class: "list-item" },
            h("div", { class: "grow" }, h("b", null, p.adversario), h("small", null, S.fmtData(p.data, true) + " · " + placar),
              pend[p.id] ? h("small", { style: "color:var(--amber)" }, "⚠ " + pend[p.id].join(" | ")) : null),
            h("button", { class: "btn small", onclick: (function (x) { return function () { abrirPartida(x); }; })(p) }, "Editar"),
            h("button", { class: "btn small danger", onclick: (function (x) { return function () { excluirPartida(x); }; })(p) }, "Excluir"));
        }))
    ];
  }

  /* ---------- atletas ---------- */
  function viewAtletas() {
    var nome = h("input", { type: "text", placeholder: "Nome" });
    var pos = h("input", { type: "text", placeholder: "Ex.: Ala / Fixo" });
    var qd = h("select", null, h("option", { value: "2" }, "2º Quadro"), h("option", { value: "1" }, "1º Quadro"));
    function add() {
      if (!nome.value.trim()) return;
      db.from("atletas").insert({ nome: nome.value.trim(), posicao: pos.value.trim() || null, quadro: Number(qd.value) }).then(function (r) {
        S.ok(r); return recarregar();
      }).then(function () { msg("ok", "Atleta adicionado."); novoForm(null); render(); }).catch(falha);
    }
    function alternar(a) {
      return function () {
        db.from("atletas").update({ ativo: !a.ativo }).eq("id", a.id).then(function (r) { S.ok(r); return recarregar(); })
          .then(function () { novoForm(null); render(); }).catch(falha);
      };
    }
    function excluir(a) {
      return function () {
        if (!window.confirm("Excluir " + a.nome + " do cadastro? Isso não pode ser desfeito.")) return;
        db.from("atletas").delete().eq("id", a.id).select("id").then(function (r) {
          if (r.error) {
            if (r.error.code === "23503") throw new Error(a.nome + " tem jogos, gols, ocorrências ou mensalidades lançados e não pode ser excluído sem apagar o histórico do time. Use “Marcar saída”.");
            throw new Error(r.error.message);
          }
          if (!r.data || !r.data.length) throw new Error("Não foi possível excluir (sem permissão).");
          return recarregar();
        }).then(function () { msg("ok", a.nome + " excluído."); novoForm(null); render(); }).catch(falha);
      };
    }
    return [
      h("div", { class: "card" }, h("h2", null, "Novo atleta"),
        h("div", { class: "row" }, h("label", { class: "f" }, "Nome", nome), h("label", { class: "f" }, "Posição", pos), h("label", { class: "f" }, "Quadro", qd)),
        h("button", { class: "btn primary", onclick: add }, "Adicionar")),
      h("div", { class: "card" }, h("h2", null, "Elenco"),
        D.atletas.map(function (a) {
          return h("div", { class: "list-item" },
            h("div", { class: "grow", style: a.ativo ? null : "color:var(--muted);text-decoration:line-through" }, h("b", null, a.nome), h("small", null, (a.posicao || "–") + (a.quadro ? " · " + a.quadro + "º Quadro" : ""))),
            h("button", { class: "btn small", onclick: alternar(a) }, a.ativo ? "Marcar saída" : "Reativar"),
            h("button", { class: "btn small danger", onclick: excluir(a) }, "Excluir"));
        }))
    ];
  }

  /* ---------- ocorrências ---------- */
  function viewOcorr(lista) {
    var sel = h("select", null, D.atletas.map(function (a) { return h("option", { value: a.id }, a.nome); }));
    var tipo = h("select", null, D.regras.filter(function (r) { return r.pontos < 0 && r.chave !== "atraso"; }).map(function (r) { return h("option", { value: r.chave }, r.descricao + " (" + r.pontos + ")"); }));
    var data = h("input", { type: "date", value: S.hoje() });
    var obs = h("input", { type: "text", placeholder: "Opcional" });
    var nomes = {}, regra = {};
    D.atletas.forEach(function (a) { nomes[a.id] = a.nome; });
    D.regras.forEach(function (r) { regra[r.chave] = r; });
    function add() {
      db.from("ocorrencias").insert({ atleta_id: Number(sel.value), tipo: tipo.value, data: data.value || null, obs: obs.value.trim() || null }).then(function (r) {
        S.ok(r); msg("ok", "Ocorrência registrada."); render();
      }).catch(falha);
    }
    function del(o) {
      return function () {
        if (!window.confirm("Remover esta ocorrência de " + nomes[o.atleta_id] + "?")) return;
        db.from("ocorrencias").delete().eq("id", o.id).then(function (r) { S.ok(r); render(); }).catch(falha);
      };
    }
    return [
      h("div", { class: "card" }, h("h2", null, "Nova ocorrência"),
        h("div", { class: "row" }, h("label", { class: "f" }, "Atleta", sel), h("label", { class: "f" }, "Tipo", tipo)),
        h("div", { class: "row" }, h("label", { class: "f" }, "Data", data), h("label", { class: "f" }, "Observação", obs)),
        h("button", { class: "btn primary", onclick: add }, "Registrar"),
        h("p", { style: "color:var(--muted);font-size:13px" }, "Atraso é lançado direto no jogo (botão “Atrasou”).")),
      h("div", { class: "card" }, h("h2", null, "Histórico"),
        lista.length ? lista.map(function (o) {
          return h("div", { class: "list-item" },
            h("div", { class: "grow" }, h("b", null, nomes[o.atleta_id] + " · " + (regra[o.tipo] ? regra[o.tipo].descricao + " (" + regra[o.tipo].pontos + ")" : o.tipo)),
              h("small", null, S.fmtData(o.data, true) + (o.obs ? " · " + o.obs : ""))),
            h("button", { class: "btn small danger", onclick: del(o) }, "Remover"));
        }) : h("div", { class: "empty" }, "Nenhuma ocorrência."))
    ];
  }

  /* ---------- mensalidades ---------- */
  function viewMensal(pagos) {
    var mes = h("input", { type: "month", value: mesSel });
    mes.onchange = function () { if (mes.value) { mesSel = mes.value; render(); } };
    var set = {};
    pagos.forEach(function (m) { if (m.pago) set[m.atleta_id] = true; });
    function alternar(a) {
      return function () {
        var q = set[a.id]
          ? db.from("mensalidades").delete().eq("atleta_id", a.id).eq("mes", mesSel + "-01")
          : db.from("mensalidades").upsert({ atleta_id: a.id, mes: mesSel + "-01", pago: true });
        q.then(function (r) { S.ok(r); render(); }).catch(falha);
      };
    }
    var ativos = D.atletas.filter(function (a) { return a.ativo || set[a.id]; });
    return h("div", { class: "card" }, h("h2", null, "Mensalidade em dia"),
      h("label", { class: "f", style: "max-width:220px" }, "Mês", mes),
      ativos.map(function (a) {
        return h("div", { class: "list-item" }, h("div", { class: "grow" }, h("b", null, a.nome)),
          h("button", { class: "toggle" + (set[a.id] ? " on" : ""), onclick: alternar(a) }, set[a.id] ? "Pago" : "Em aberto"));
      }));
  }

  /* ---------- render ---------- */
  function render() {
    S.clear(tabsEl);
    ABAS.forEach(function (a) {
      tabsEl.appendChild(h("button", { class: aba === a[0] ? "on" : null, onclick: (function (id) { return function () { aba = id; aviso = null; render(); window.scrollTo(0, 0); }; })(a[0]) }, a[1]));
    });
    tabsEl.appendChild(h("button", { onclick: sair }, "Sair"));
    var av = aviso; aviso = null;
    function pintar(v) {
      S.clear(main);
      if (av) main.appendChild(h("div", { class: av.tipo }, av.texto));
      (Array.isArray(v) ? v : [v]).forEach(function (el) { if (el) main.appendChild(el); });
    }
    if (aba === "jogo") pintar(viewJogo());
    else if (aba === "jogos") pintar(viewJogos());
    else if (aba === "atletas") pintar(viewAtletas());
    else if (aba === "ocorr") {
      db.from("ocorrencias").select("*").order("id", { ascending: false }).then(function (r) { pintar(viewOcorr(S.ok(r))); }).catch(falha);
    } else if (aba === "mensal") {
      db.from("mensalidades").select("*").eq("mes", mesSel + "-01").then(function (r) { pintar(viewMensal(S.ok(r))); }).catch(falha);
    }
  }

  iniciar();
})();
