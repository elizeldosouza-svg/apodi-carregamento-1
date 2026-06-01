# CLAUDE.md — Sistema de Rastreio de Carregamento
### Apodi Cimentos · Documento de Contexto para IA e Desenvolvedores

---

## 1. Visão Geral do Projeto

### Nome da Aplicação
**Sistema de Rastreio de Carregamento — Apodi Cimentos**

### Objetivo Principal
Rastrear em tempo real o ciclo completo de carregamento de caminhões dentro da fábrica de cimento, desde a entrada no Posto 1 até a saída no Faturamento, passando por Portaria, Triagem, Carregamento e Enlonamento.

### Problema que Resolve
Antes do sistema, a operação era gerenciada com papel, planilhas manuais e comunicação verbal. Isso gerava:
- Fila de caminhões invisível — sem visibilidade de quantos aguardavam e em qual etapa
- Atrasos sem registro ou justificativa
- Dados dispersos sem histórico confiável
- Motoristas chamados sem comparecimento sem nenhum controle
- Impossibilidade de calcular TMAC (Tempo Médio de Atendimento por Caminhão)

### Público-Alvo
- **Operadores de campo** (Posto 1, Portaria, Triagem, Carregamento, Enlonamento, Faturamento)
- **Gestores logísticos** (Master, Análise, Justificativas)
- **Motoristas de caminhão** (Painel de Chamada — TV)
- **Administradores do sistema** (Admin)

### Casos de Uso Principais
1. Registrar entrada de caminhão no Posto 1 com placa, AC, tipo de carga e tipo de cimento
2. Chamar próximo veículo da fila manualmente na TV com áudio automático
3. Fotografar placa com OCR (Claude Vision API) para registrar início/fim de cada etapa
4. Monitorar todos os veículos em tempo real no Master com filtros avançados
5. Justificar atrasos e não comparecimentos com motivos catalogados
6. Exportar relatórios em PDF e Excel por turno, período e tipo de carga
7. Administrar e corrigir qualquer dado via painel Admin autenticado

### Regras de Negócio de Alto Nível
- Um veículo **não pode ser registrado duas vezes** com a mesma Placa + AC em processo
- Veículos que **não concluíram o processo** aparecem no dia atual mesmo após virada de meia-noite
- O **TMAC limite** é de 2h10min — acima disso, exige justificativa obrigatória
- **Turnos:** A (23h–07h), B (07h–15h), C (15h–23h)
- Filtros de **período/data** usam data de **saída** para veículos concluídos e data de **entrada** para em processo
- Filtros de **turno, carga e cimento** usam sempre a data/hora de **entrada**
- O token de autenticação Admin expira em **8 horas**
- Não comparecimento após chamada gera **justificativa obrigatória** antes de passar para o próximo

---

## 2. Stack Tecnológica

### Frontend
| Tecnologia | Versão | Uso |
|---|---|---|
| HTML5 | — | Estrutura de todas as telas |
| CSS3 | — | Estilo dark/cyberpunk, variáveis CSS, animações |
| JavaScript ES2022 | — | Lógica de todas as telas (modules nativos) |
| Google Fonts | — | Rajdhani, Orbitron, Inter, JetBrains Mono |

**Padrão:** Single-file HTML por tela (sem build, sem bundler). Cada arquivo é autossuficiente.

### Backend / API
| Tecnologia | Uso |
|---|---|
| Firebase Firestore | Banco de dados em tempo real (WebSocket via onSnapshot) |
| Anthropic Claude Vision API | OCR de placas via foto (base64) |
| Web Speech API (nativa) | TTS para chamada de motoristas no Painel TV |

### Banco de Dados
**Firebase Firestore** (NoSQL, document-based)
- Projeto: `cimento-6163b`
- Sincronização via `onSnapshot` — zero polling, atualizações em milissegundos

### Infraestrutura
| Serviço | Uso |
|---|---|
| Vercel | Deploy estático, 15 rotas limpas, HTTPS, CDN global |
| GitHub | Repositório: `elizeldosouza-svg/apodi-carregamento-1` |

### Serviços Externos
- **Anthropic API** (`claude-sonnet-4-20250514`) — OCR de placas nas telas operacionais
- **Firebase** — Auth implícita via localStorage + sessionStorage (sem Firebase Auth formal)

### Autenticação
- Admin: credenciais hardcoded (`administrador` / `admin2026`)
- Token: `localStorage.admin_auth` + `localStorage.admin_auth_ts` (TTL 8h)
- Badge de modo admin injetado em todas as telas quando logado

### CI/CD
- Deploy automático via **Vercel** ao fazer push no repositório GitHub
- Sem pipeline formal — deploy direto da branch principal

---

## 3. Arquitetura do Sistema

### Arquitetura Adotada
**Serverless Static Architecture** — sem servidor próprio. Toda a lógica reside no frontend (browser). O Firestore serve como backend em tempo real.

```mermaid
graph TB
    subgraph Operadores
        P1[Posto 1]
        PT[Portaria]
        TR[Triagem]
        CA[Carregamento]
        EN[Enlonamento]
        FA[Faturamento]
    end

    subgraph Gestão
        MA[Master]
        AN[Análise]
        JU[Justificativas]
        PA[Pátio]
        PL[Placas]
        AD[Admin]
    end

    subgraph TV
        SE[Senha - Painel TV]
    end

    subgraph Firebase
        FS[(Firestore\ncaminhoes_rastreio\nchamadas_fila\njustificativas\nconfig)]
    end

    subgraph APIs
        CV[Claude Vision API\nOCR Placas]
        TTS[Web Speech API\nTTS Motoristas]
    end

    P1 -->|addDoc| FS
    PT -->|updateDoc| FS
    TR -->|updateDoc| FS
    CA -->|updateDoc| FS
    EN -->|updateDoc| FS
    FA -->|updateDoc| FS

    FS -->|onSnapshot| MA
    FS -->|onSnapshot| AN
    FS -->|onSnapshot| JU
    FS -->|onSnapshot| PA
    FS -->|onSnapshot| PL
    FS -->|onSnapshot| AD
    FS -->|onSnapshot| SE

    TR -->|base64 foto| CV
    CA -->|base64 foto| CV
    EN -->|base64 foto| CV

    SE -->|fala placa| TTS
```

### Fluxo Operacional
```mermaid
flowchart LR
    A([Chegada\nCaminhão]) --> B[Posto 1\nRegistro]
    B --> C[Portaria\nEntrada/Saída]
    C --> D[Triagem\nFoto + OCR]
    D --> E[Carregamento\nFoto + OCR]
    E --> F[Enlonamento\nFoto + OCR]
    F --> G[Faturamento\nConfirma Saída]
    G --> H([Concluído])
```

### Fluxo de Dados do Firestore
```mermaid
sequenceDiagram
    participant OP as Operador
    participant FS as Firestore
    participant TV as Painel TV
    participant MA as Master

    OP->>FS: addDoc (caminhoes_rastreio)
    FS-->>MA: onSnapshot → render()
    OP->>FS: addDoc (chamadas_fila)
    FS-->>TV: onSnapshot → showCall()
    TV->>TV: doSound() + falarPlaca()
    OP->>FS: updateDoc (justificativas)
    FS-->>TV: onSnapshot → overlay fecha
```

---

## 4. Estrutura de Pastas

```
apodi-carregamento-1/
├── posto1.html          # Registro de entrada + fila manual de chamada
├── portaria.html        # Etapa portaria (entrada/saída) + export PDF
├── triagem.html         # Triagem com OCR de placa via Claude Vision
├── carregamento.html    # Carregamento com OCR de placa
├── enlonamento.html     # Enlonamento com OCR de placa
├── faturamento.html     # Confirmação de saída
├── master.html          # Painel de rastreio geral (gestão)
├── patio.html           # Status do pátio em tempo real
├── analise.html         # Relatórios históricos e TMAC
├── justificativas.html  # Registro e consulta de justificativas
├── placas.html          # Histórico por placa/veículo
├── admin.html           # Painel administrativo com autenticação
├── senha.html           # Painel de chamada para TV (motoristas)
├── editor_visual.html   # Editor WYSIWYG de telas
└── vercel.json          # Configuração de rotas do Vercel
```

### Responsabilidade de Cada Arquivo

| Arquivo | Responsabilidade | Grava no Firestore | Lê do Firestore |
|---|---|---|---|
| `posto1.html` | Registro de entrada, fila manual | `caminhoes_rastreio`, `chamadas_fila`, `justificativas` | `caminhoes_rastreio` |
| `portaria.html` | Registro portaria ini/fim + export PDF | `caminhoes_rastreio` (portaria.*) | `caminhoes_rastreio` |
| `triagem.html` | OCR + registro triagem ini/fim | `caminhoes_rastreio` (triagem.*) | `caminhoes_rastreio` |
| `carregamento.html` | OCR + registro carregamento ini/fim | `caminhoes_rastreio` (carregamento.*) | `caminhoes_rastreio` |
| `enlonamento.html` | OCR + registro enlonamento ini/fim | `caminhoes_rastreio` (enlonamento.*) | `caminhoes_rastreio` |
| `faturamento.html` | Confirmação de saída | `caminhoes_rastreio` (faturamento.ts, setorAtual) | `caminhoes_rastreio` |
| `master.html` | Rastreio geral, filtros, Excel | — | `caminhoes_rastreio` |
| `patio.html` | Status ao vivo por setor | — | `caminhoes_rastreio` |
| `analise.html` | TMAC, histórico, gráficos | — | `caminhoes_rastreio` |
| `justificativas.html` | Pendências + justificativas | `justificativas` | `caminhoes_rastreio`, `justificativas` |
| `placas.html` | Histórico por placa | — | `caminhoes_rastreio` |
| `admin.html` | CRUD completo com auth | `caminhoes_rastreio` (qualquer campo) | `caminhoes_rastreio` |
| `senha.html` | Painel TV, TTS, fila | — | `caminhoes_rastreio`, `chamadas_fila`, `justificativas` |

---

## 5. Convenções de Código

### Nomenclatura
```javascript
// Variáveis de estado global: maiúsculas
let ALL = [], MP = "hoje", MF = "t", MT = "t", MTC = "t", MTCIM = "t";

// Funções expostas ao window (chamadas por onclick):
window.registrar = async () => {};
window.setTipoCarga = (t, el) => {};

// Funções internas: camelCase
function getFiltered() {}
function renderFilas() {}
function durStr(ms) {}

// Constantes de configuração: SCREAMING_SNAKE
const LIMITE_MS = 130 * 60 * 1000; // 2h10
const CREDS = { user: "administrador", pwd: "admin2026" };
```

### Padrão de Imports Firebase
```javascript
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, query, orderBy,
         addDoc, updateDoc, deleteDoc, doc, Timestamp }
  from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
```

### Padrão de Tela Operacional
Toda tela operacional (posto1, portaria, triagem, carregamento, enlonamento, faturamento) segue este padrão:
```javascript
// 1. Escuta coleção com filtro de virada de dia
onSnapshot(collection(db, "caminhoes_rastreio"), snap => {
  const hj = hoje();
  HD = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(c => c.data === hj || (c.data < hj && c.setorAtual !== "concluido"));
});

// 2. Helper de data no fuso de Fortaleza
const hoje = () => new Date().toLocaleDateString("pt-BR",
  { timeZone: "America/Fortaleza" }).split("/").reverse().join("-");

// 3. Timestamp sempre com Timestamp.fromDate(new Date())
await updateDoc(ref, { "etapa.inicio": Timestamp.fromDate(new Date()) });
```

### CSS Variables Padrão
```css
:root {
  --bg: #0a0f1e;      /* fundo principal */
  --c1: #0f1a2e;      /* cards/inputs */
  --bd: #1e3558;      /* bordas */
  --tx: #dff0ff;      /* texto principal */
  --t2: #7aafcc;      /* texto secundário */
  --t3: #3a6880;      /* texto terciário */
  --ac: #00d4ff;      /* accent (ciano) */
  --gr: #00e896;      /* verde sucesso */
  --ye: #ffd000;      /* amarelo cimento */
  --rd: #ff4466;      /* vermelho erro */
  --or: #fb923c;      /* laranja granel */
  --pu: #a78bfa;      /* roxo gestão */
}
```

---

## 6. Padrões Arquiteturais

### Observer Pattern
Utilizado extensivamente via `onSnapshot` do Firestore. Cada tela é um observer independente da coleção `caminhoes_rastreio`. Qualquer mudança no banco propaga instantaneamente para todos os painéis abertos.

### Single Responsibility
Cada arquivo HTML tem uma única responsabilidade operacional. A tela de Triagem só registra triagem; o Master só visualiza; o Admin só edita.

### Normalização no Snapshot (Data Integrity)
```javascript
// Padrão aplicado no Master para corrigir inconsistências do Firestore
ALL = snap.docs.map(d => {
  const data = { id: d.id, ...d.data() };
  // Normaliza: se tem saída mas setorAtual não foi atualizado (falha de rede)
  if (data.faturamento?.ts && data.setorAtual !== "concluido") {
    data.setorAtual = "concluido";
  }
  return data;
});
```

### Anti-Duplicidade (Guard Pattern)
```javascript
let REGISTRANDO = false;
window.registrar = async () => {
  if (REGISTRANDO) return; // trava contra duplo clique
  REGISTRANDO = true;
  // ... operação assíncrona
  REGISTRANDO = false;
};
```

---

## 7. Banco de Dados

### Coleções Firestore

#### `caminhoes_rastreio` (coleção principal)
```javascript
{
  // Identificação
  placa: "ABC1234",           // string, uppercase, sem hífen
  ac: "AC-001",               // string, uppercase
  tipoCarga: "granel",        // enum: "ensacado" | "granel" | "bigbag"
  tipoCargaLabel: "Granel",   // string amigável
  tipoCimento: "CP II F",     // enum: "CP II F" | "CP III" | "CP V"
  tipoCimentoLabel: "CP II F",

  // Controle de fluxo
  setorAtual: "carregamento_inicio", // enum — ver abaixo
  data: "2026-05-25",         // string YYYY-MM-DD (fuso Fortaleza)
  criadoEm: Timestamp,

  // Etapas (cada uma com timestamps)
  entrada:      { ts: Timestamp },
  portaria:     { inicio: Timestamp, fim: Timestamp },
  triagem:      { inicio: Timestamp, fim: Timestamp },
  carregamento: { inicio: Timestamp, fim: Timestamp },
  enlonamento:  { inicio: Timestamp, fim: Timestamp },
  faturamento:  { ts: Timestamp },

  // Opcional
  observacao: "string",
  notaFiscal: "string",
  justificativa: { motivo: "string", descricao: "string" }
}
```

**Enum `setorAtual`:**
```
"posto1" → "portaria_inicio" → "portaria_fim" →
"triagem_inicio" → "triagem_fim" →
"carregamento_inicio" → "carregamento_fim" →
"enlonamento_inicio" → "enlonamento_fim" →
"faturamento_aguardando" → "concluido"
```

#### `chamadas_fila`
```javascript
{
  numero: 17,              // sequencial do dia
  placa: "ABC1234",
  ac: "AC-001",
  tipoCarga: "granel",
  tipoCimento: "CP II F",
  veiculoId: "firestore_doc_id",
  data: "2026-05-25",
  criadoEm: Timestamp,
  status: "chamado"
}
```

#### `justificativas`
```javascript
{
  placa: "ABC1234",
  ac: "AC-001",
  motivo: "Concentração de Veículos",  // ver lista de motivos
  tipo: "nao_compareceu" | "atraso",
  tipoCarga: "granel",
  tipoCimento: "CP II F",
  data: "2026-05-25",
  criadoEm: "ISO string"
}
```

#### `config`
```javascript
// Documento: "chamadas_contador_YYYY-MM-DD"
{ n: 17 }  // contador de chamadas do dia
```

### Motivos de Justificativa (19 opções)
```
ICD Elevado | Absenteísmo Logística | Falha de Processos Logística |
Concentração de Veículos | Plataforma de Grades | DDS |
Dificuldade de Extração | Falha de Equipamento | Quadro Reduzido Produção |
Falha de Processos Produção | Ausência de Estoque | Manutenção Preventiva |
Manutenção Corretiva | Troca de Turno | Transf. Acima do Plano |
Transf. Abaixo do Plano | Falha de Sistema | Faturamento Manual |
---TMAC Online Teste---
```

---

## 8. API

### Claude Vision API (OCR de Placas)
```javascript
// Endpoint: POST https://api.anthropic.com/v1/messages
const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } },
        { type: "text", text: "Leia a placa do veículo nesta imagem. Responda APENAS com os caracteres da placa, sem espaços ou hífens. Exemplo: ABC1234" }
      ]
    }]
  })
});
const data = await response.json();
const placa = data.content[0].text.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
```

**Erro frequente:** `"Your credit balance is too low"` → Recarregar créditos em console.anthropic.com

### Firestore — Operações Principais

#### Criar veículo (Posto 1)
```javascript
await addDoc(collection(db, "caminhoes_rastreio"), {
  ac, placa, setorAtual: "posto1",
  tipoCarga, tipoCargaLabel, tipoCimento, tipoCimentoLabel,
  entrada: { ts: Timestamp.fromDate(new Date()) },
  data: hoje(), criadoEm: Timestamp.fromDate(new Date())
});
```

#### Avançar etapa (telas operacionais)
```javascript
await updateDoc(doc(db, "caminhoes_rastreio", id), {
  "triagem.inicio": Timestamp.fromDate(new Date()),
  setorAtual: "triagem_inicio"
});
```

#### Concluir (Faturamento)
```javascript
await updateDoc(doc(db, "caminhoes_rastreio", id), {
  "faturamento.ts": Timestamp.fromDate(new Date()),
  setorAtual: "concluido"
});
```

---

## 9. Segurança

### Autenticação Admin
```javascript
const CREDS = { user: "administrador", pwd: "admin2026" };

// Login: salva em sessionStorage (aba) + localStorage (cross-tab, TTL 8h)
sessionStorage.setItem("admin_auth", "1");
localStorage.setItem("admin_auth", "1");
localStorage.setItem("admin_auth_ts", Date.now().toString());

// Verificação
function isAdminLogado() {
  if (sessionStorage.getItem("admin_auth") === "1") return true;
  try {
    const ts = parseInt(localStorage.getItem("admin_auth_ts") || "0");
    const ok = localStorage.getItem("admin_auth") === "1"
      && ts > 0 && (Date.now() - ts) < 8 * 60 * 60 * 1000;
    if (ok) { sessionStorage.setItem("admin_auth", "1"); return true; }
    localStorage.removeItem("admin_auth");
    localStorage.removeItem("admin_auth_ts");
  } catch (ignore) {}
  return false;
}
```

### Proteções Implementadas
- **Anti-duplicidade:** Placa + AC verificados antes de qualquer `addDoc`
- **Flag anti-double-click:** `REGISTRANDO = true` durante operações assíncronas
- **Validação de placa:** `replace(/[^A-Z0-9]/g, "")` + verificação de 7 caracteres
- **Firestore Rules:** Não configuradas (projeto interno, rede fechada)

### ⚠️ Débitos de Segurança
- Credenciais Admin hardcoded no frontend (visível no código-fonte)
- Firestore sem regras de segurança (acesso público à coleção)
- Sem CSRF protection (não aplicável — sem formulários server-side)
- API Key Anthropic exposta no frontend

---

## 10. Performance

### Estratégias Implementadas
- **onSnapshot** em vez de polling — zero requests desnecessários
- **Normalização no client** — dados corrigidos em memória sem roundtrip extra
- **Renderização incremental** — `render()` só executado quando snapshot muda
- **Deduplicação de IDs** antes de renderizar
```javascript
const seen = new Set();
list = list.filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });
```

### Filtros Computados em Memória
Todos os filtros (período, turno, carga, cimento, status) são aplicados sobre o array `ALL` em memória — sem queries adicionais ao Firestore.

### Helper de Referência Temporal
```javascript
// Evita recalcular datas repetidamente
function tsRef(c) {
  if (c.setorAtual === "concluido") {
    const sa = getTS(c, "faturamento", "ts");
    return sa || getTS(c, "entrada", "ts");
  }
  return getTS(c, "entrada", "ts");
}
```

---

## 11. Testes

> ⚠️ **Não há testes automatizados implementados.** Este é o maior débito técnico do projeto.

### Testes Manuais Recomendados por Cenário

| Cenário | Verificar |
|---|---|
| Virada de meia-noite | Veículo em processo aparece no dia seguinte |
| Duplo clique em Registrar | Apenas um documento criado |
| Mesma Placa + AC | Bloqueio com mensagem de erro |
| Faturamento sem setorAtual | Master normaliza para "concluido" |
| Filtro por turno B | Só veículos com entrada entre 07h–15h |
| Filtro por data no calendário | Concluídos pela saída, em processo pela entrada |

---

## 12. Observabilidade

### Logs
- `console.error` para falhas de Firestore e API
- `showMsg("er", "texto")` para erros visíveis ao operador

### Mensagens ao Usuário
```javascript
// Sistema de mensagens inline (sem alert())
function showMsg(tipo, txt) {
  // tipo: "ok" (verde) | "er" (vermelho) | "wn" (amarelo)
  const el = document.getElementById("msg");
  el.className = `msg msg-${tipo}`;
  el.textContent = txt;
  if (tipo !== "er") setTimeout(() => el.className = "msg", 4000);
}
```

### Monitoramento
- Sem APM formal (Datadog, Sentry, etc.)
- Erros de API Anthropic visíveis diretamente na tela do operador
- Falhas de Firestore exibidas via `showMsg("er", e.message)`

---

## 13. Fluxo de Desenvolvimento

### Deploy
1. Editar arquivo HTML localmente
2. Fazer upload no repositório GitHub (`elizeldosouza-svg/apodi-carregamento-1`)
3. Vercel detecta push e faz deploy automático (~30 segundos)
4. URL disponível em `https://apodi-carregamento.vercel.app/{rota}`

### Adicionar Nova Tela
1. Criar `nova-tela.html` baseada em uma tela operacional existente
2. Adicionar rota no `vercel.json`:
```json
{ "source": "/nova-rota", "destination": "/nova-tela.html" }
```
3. Adicionar link de navegação nas telas de gestão (master, admin, analise, patio, placas, justificativas)
4. Adicionar badge admin (`<!-- Badge Admin -->`) antes do `</body>`
5. Aplicar fix de virada de dia no filtro do `onSnapshot`

### Correção de Bug Crítico
1. Identificar qual arquivo HTML está afetado
2. Fazer backup (copiar para `/home/claude/nome_backup.html`)
3. Aplicar correção cirúrgica (str_replace específico)
4. Verificar sintaxe JS: `node -e "new Function(js)"` antes de subir

---

## 14. Regras para Agentes de IA

### O Agente DEVE:
- ✅ Ler o arquivo antes de qualquer alteração (`view` nas linhas relevantes)
- ✅ Usar `str_replace` cirúrgico — nunca reescrever o arquivo inteiro sem necessidade
- ✅ Verificar sintaxe JS após alterações no bloco `<script type="module">`
- ✅ Aplicar o fix de virada de dia em toda tela operacional nova
- ✅ Expor funções chamadas por `onclick` via `window.nomeFuncao`
- ✅ Usar `Timestamp.fromDate(new Date())` para gravar timestamps no Firestore
- ✅ Usar o fuso `America/Fortaleza` em todas as operações de data/hora
- ✅ Testar duplicidade antes de `addDoc` (verificar placa + AC)
- ✅ Adicionar badge admin em toda nova tela
- ✅ Atualizar `vercel.json` ao criar nova tela
- ✅ Verificar todos os checks após alteração antes de confirmar

### O Agente NÃO DEVE:
- ❌ Usar caracteres especiais (travessões `—`, acentos) em comentários JS — causam `Invalid token`
- ❌ Colocar funções chamadas por `onclick` fora do `<script type="module">` sem expor via `window`
- ❌ Criar scripts externos ao módulo que acessem variáveis do módulo (ex: `HD`, `hoje()`)
- ❌ Substituir `Timestamp.fromDate` por `new Date()` diretamente em campos Firestore
- ❌ Usar `c.data === hoje()` como único filtro — sempre incluir presos: `c.data < hj && c.setorAtual !== "concluido"`
- ❌ Alterar o `vercel.json` sem verificar rotas existentes
- ❌ Modificar credenciais ou configuração Firebase sem confirmação explícita
- ❌ Criar dependências externas (npm packages) — arquitetura é zero-dependency no frontend
- ❌ Remover o badge admin de telas existentes
- ❌ Ignorar o padrão de normalização no `onSnapshot` do master

### Checklist de Sintaxe JS (OBRIGATÓRIO após edição)
```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('arquivo.html', 'utf8');
const idx = html.indexOf('<script type=\"module\">');
const endIdx = html.lastIndexOf('</script>');
const js = html.slice(idx + '<script type=\"module\">'.length, endIdx);
const jsClean = js.replace(/^import[^\n]+\n/gm, '');
try { new Function(jsClean); console.log('OK'); }
catch(e) { console.log('ERRO:', e.message); }
"
```

---

## 15. Checklist para Novas Funcionalidades

Antes de considerar qualquer tarefa concluída:

- [ ] **Fix virada de dia** aplicado: `.filter(c => c.data === hj || (c.data < hj && c.setorAtual !== "concluido"))`
- [ ] **Sintaxe JS** verificada com `node -e "new Function(js)"`
- [ ] **Funções onclick** expostas via `window.nomeFuncao`
- [ ] **Comentários JS** sem caracteres especiais (acentos, travessões)
- [ ] **Badge admin** adicionado ao `</body>`
- [ ] **Rota** adicionada ao `vercel.json` se nova tela
- [ ] **Links de navegação** adicionados nas telas de gestão
- [ ] **Anti-duplicidade** implementada se tela criar documentos
- [ ] **Flag REGISTRANDO** implementada se houver operação assíncrona com clique
- [ ] **Fuso America/Fortaleza** usado em todas as datas
- [ ] **Normalização no snapshot** implementada se tela ler `caminhoes_rastreio`

---

## 16. Roadmap Técnico

### Débitos Técnicos Críticos
| Débito | Impacto | Prioridade |
|---|---|---|
| Credenciais Admin hardcoded | Segurança — visível no código-fonte | Alta |
| Sem regras Firestore | Qualquer pessoa pode ler/escrever | Alta |
| API Key Anthropic exposta | Uso não autorizado da API | Alta |
| Sem testes automatizados | Regressões não detectadas | Média |
| Sem tratamento de offline | Operação para se perder conexão | Média |

### Melhorias Planejadas
- [ ] Firebase Authentication formal (email/senha por perfil)
- [ ] Firestore Security Rules por coleção e perfil
- [ ] Proxy server para esconder API Keys (Vercel Edge Functions)
- [ ] PWA com Service Worker para funcionamento offline
- [ ] Testes E2E com Playwright
- [ ] Dashboard de métricas operacionais em tempo real
- [ ] Notificações push para gestores quando TMAC é excedido
- [ ] Integração com sistema de NF-e para preencher Nota Fiscal automaticamente
- [ ] Histórico de edições no Admin (audit log)
- [ ] Exportação automática de relatório diário por e-mail

### Evoluções Arquiteturais Futuras
- Separar lógica em módulos JS importáveis (`utils.js`, `firebase.js`, `auth.js`)
- Adotar build system (Vite) para tree-shaking e otimização
- Backend próprio (Node.js + Express) para operações sensíveis
- Migrar para TypeScript para segurança de tipos

---

## 17. Contexto para IA

### Resumo Executivo
Sistema web de rastreio logístico para fábrica de cimento. **Zero backend próprio** — 100% frontend com Firebase Firestore em tempo real. Cada tela é um arquivo HTML single-file autossuficiente. Deploy no Vercel com 15 rotas limpas.

### Componentes Críticos
1. **`master.html`** — painel central de gestão com lógica de filtros complexa (período, turno, carga, cimento, calendário). Contém normalização de dados do Firestore e cálculo de TMAC.
2. **`posto1.html`** — único ponto de criação de documentos (`addDoc`). Contém anti-duplicidade e fila manual de chamada.
3. **`senha.html`** — painel TV em tempo real com TTS automático. Recebe dados de `chamadas_fila`.
4. **`admin.html`** — único arquivo com autenticação. Permite editar qualquer campo de qualquer documento.

### Restrições Técnicas
- **Sem bundler** — tudo é ES Modules nativos do browser
- **Sem TypeScript** — JavaScript puro
- **Sem npm** — zero dependências externas além de Firebase (CDN) e Anthropic API
- **Single-file** — CSS, HTML e JS no mesmo arquivo por tela
- **Fuso fixo** — sempre `America/Fortaleza` (UTC-3, sem DST)

### Regras de Negócio Críticas
1. Veículo com `faturamento.ts` preenchido = `concluido` (independente do `setorAtual`)
2. Filtro de período para concluídos usa **data de saída**; para em processo usa **data de entrada**
3. Filtros de turno/carga/cimento usam sempre **data de entrada**
4. Veículo em processo de dia anterior sempre aparece no filtro "Hoje"
5. TMAC > 2h10 exige justificativa no módulo de Justificativas

### Decisões Arquiteturais Relevantes
| Decisão | Motivo |
|---|---|
| Single-file HTML | Simplicidade de deploy — upload direto no GitHub |
| Firestore em vez de REST API | Tempo real nativo sem polling |
| onSnapshot em todas as telas | Consistência instantânea entre todos os operadores |
| Normalização no client | Corrige falhas de escrita parcial sem migrations |
| window.funcao para onclick | Módulos ES não expõem ao escopo global automaticamente |
| América/Fortaleza fixo | Fábrica opera em único fuso, sem ambiguidade |

### Firebase Config (Produção)
```javascript
{
  apiKey: "AIzaSyCMacFP0kGkgOTCqdWzf6Y65LN2q4tw28Y",
  authDomain: "cimento-6163b.firebaseapp.com",
  projectId: "cimento-6163b",
  storageBucket: "cimento-6163b.firebasestorage.app",
  messagingSenderId: "773785464621",
  appId: "1:773785464621:web:02dc9de04a7e2af231ada4"
}
```

### URLs de Produção
```
https://apodi-carregamento.vercel.app/posto1
https://apodi-carregamento.vercel.app/portaria
https://apodi-carregamento.vercel.app/triagem
https://apodi-carregamento.vercel.app/carregamento
https://apodi-carregamento.vercel.app/enlonamento
https://apodi-carregamento.vercel.app/faturamento
https://apodi-carregamento.vercel.app/master
https://apodi-carregamento.vercel.app/patio
https://apodi-carregamento.vercel.app/analise
https://apodi-carregamento.vercel.app/justificativas
https://apodi-carregamento.vercel.app/placas
https://apodi-carregamento.vercel.app/admin
https://apodi-carregamento.vercel.app/senha
https://apodi-carregamento.vercel.app/editor
```

---

*Documento gerado em 01/06/2026 · Versão 1.0 · Apodi Cimentos · Sistema de Rastreio de Carregamento*
