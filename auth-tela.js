// auth-tela.js — Autenticação multiusuário por tela (TMAC Online)
// Coleção Firestore: operadores_acesso
// Doc: { tela, empresa, usuario, senha, nome, primeiroAcesso, ativo, criadoEm, atualizadoEm }
import{collection,query,where,getDocs,doc,updateDoc,Timestamp}from"https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const SESSAO_MS=8*60*60*1000; // 8 horas

function keys(tela){
  return{
    user:"auth_"+tela+"_user",
    nome:"auth_"+tela+"_nome",
    doc:"auth_"+tela+"_doc",
    ts:"auth_"+tela+"_ts"
  };
}

export function verificarSessao(tela){
  const k=keys(tela);
  try{
    const ts=parseInt(localStorage.getItem(k.ts)||"0");
    const ok=localStorage.getItem(k.user)&&ts>0&&(Date.now()-ts)<SESSAO_MS;
    if(ok){
      return{logado:true,usuario:localStorage.getItem(k.user),nome:localStorage.getItem(k.nome),docId:localStorage.getItem(k.doc)};
    }
    Object.values(k).forEach(key=>localStorage.removeItem(key));
  }catch(ignore){}
  return{logado:false};
}

function salvarSessao(tela,usuario,nome,docId){
  const k=keys(tela);
  localStorage.setItem(k.user,usuario);
  localStorage.setItem(k.nome,nome);
  localStorage.setItem(k.doc,docId);
  localStorage.setItem(k.ts,Date.now().toString());
}

export async function fazerLogin(db,tela,usuario,senha){
  if(!usuario||!senha)return{ok:false,erro:"Preencha usuário e senha."};
  const q=query(collection(db,"operadores_acesso"),where("tela","==",tela),where("usuario","==",usuario.trim().toLowerCase()));
  const snap=await getDocs(q);
  const d=snap.docs.find(x=>x.data().ativo!==false);
  if(!d)return{ok:false,erro:"Usuário ou senha incorretos."};
  const data=d.data();
  if(data.senha!==senha)return{ok:false,erro:"Usuário ou senha incorretos."};
  if(data.primeiroAcesso){
    return{ok:true,primeiroAcesso:true,docId:d.id,usuario:data.usuario,nome:data.nome};
  }
  salvarSessao(tela,data.usuario,data.nome,d.id);
  return{ok:true,primeiroAcesso:false,logado:true,docId:d.id,usuario:data.usuario,nome:data.nome};
}

export async function salvarNovaSenha(db,tela,docId,usuario,nome,novaSenha){
  await updateDoc(doc(db,"operadores_acesso",docId),{senha:novaSenha,primeiroAcesso:false,atualizadoEm:Timestamp.fromDate(new Date())});
  salvarSessao(tela,usuario,nome,docId);
  return{logado:true,usuario,nome,docId};
}

export function fazerLogout(tela){
  const k=keys(tela);
  Object.values(k).forEach(key=>localStorage.removeItem(key));
}
