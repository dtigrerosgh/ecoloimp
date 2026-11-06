let DB_USUARIOS=[],DB_CLIENTES=[],DB_IMPRESORAS=[],DB_TECNICOS=[],DB_BODEGAS=[],DB_TRABAJOS=[],DB_INVENTARIOS=[];
let DATOS_LISTOS=false;
function $(id){return document.getElementById(id)}
function norm(s){return (s||'').toLowerCase()}

async function cargarDatosPrimero(){
  const log=(m,c)=>{ $("loadStatus").innerHTML=m; if(c) $("loadStatus").style.color=c; console.log(m); }
  log('⏳ Cargando data/*.txt ...');
  
  // Si es file:// mostramos fallback a los 1.5 segundos
  if(location.protocol==='file:'){
    setTimeout(()=>{ if(!DATOS_LISTOS){ $("fallbackFiles").classList.remove('hidden'); log('⚠️ file:// detectado. Selecciona los txt abajo o usa Live Server','#dc2626'); $("btnLogin").textContent='Selecciona los txt abajo'; } },1500);
  }

  async function fetchTxt(ruta){
    const res = await fetch(ruta+'?v='+Date.now());
    if(!res.ok) throw new Error(ruta+' HTTP '+res.status);
    let t = await res.text(); t=t.replace(/^\uFEFF/,'').trim(); if(!t) throw new Error(ruta+' vacío'); return t;
  }

  try{
    // Intenta carga automática (solo funciona en http://)
    const [u,c,i,t,b,tr,inv] = await Promise.allSettled([
      fetchTxt('data/usuarios.txt'),
      fetchTxt('data/clientes.txt'),
      fetchTxt('data/impresoras.txt'),
      fetchTxt('data/tecnicos.txt'),
      fetchTxt('data/bodegas.txt'),
      fetchTxt('data/trabajos.txt'),
      fetchTxt('data/inventarios.txt')
    ]);

    // Si falla usuarios.txt es crítico, lanzamos error para activar fallback
    if(u.status!=='fulfilled') throw new Error('No se pudo cargar data/usuarios.txt. '+ (location.protocol==='file:'?'Estás en file://':'Verifica que existe'));

    procesarTextos(
      u.status==='fulfilled'?u.value:'',
      c.status==='fulfilled'?c.value:'00001|CLIENTE DEMO',
      i.status==='fulfilled'?i.value:'00001|HP009|HP M428|PRN-001|GUAYAQUIL|ADMIN|Oficina 201|097',
      t.status==='fulfilled'?t.value:'T01|Carlos',
      b.status==='fulfilled'?b.value:'097|BODEGA MATRIZ',
      tr.status==='fulfilled'?tr.value:'001|PREVENTIVO',
      inv.status==='fulfilled'?inv.value:'097|TON-001|CF258A|TONER HP 58A|15'
    );

  }catch(e){
    console.error(e);
    log('❌ '+e.message+'<br><small>Usa selector manual abajo</small>','#dc2626');
    $("fallbackFiles").classList.remove('hidden');
    // Habilita login demo para no quedarse bloqueado
    DB_USUARIOS=[{usuario:'admin',clave:'admin123',nombre:'Admin Demo',rol:'admin'},{usuario:'tecnico1',clave:'1234',nombre:'Tecnico Demo',rol:'tecnico'}];
    DATOS_LISTOS=true;
    $("btnLogin").disabled=false;
    $("btnLogin").textContent='Entrar (modo demo)';
    $("loadStatus").innerHTML+='<br><small style="color:#16a34a">Demo habilitado: admin/admin123</small>';
  }
}

function procesarTextos(uTxt,cTxt,iTxt,tTxt,bTxt,trTxt,invTxt){
  try{
    DB_USUARIOS = uTxt.split('\n').filter(l=>l.trim()&&!l.trim().startsWith('#')).map(l=>{const a=l.split('|').map(x=>x.trim()); return {usuario:a[0], clave:a[1], nombre:a[2]||a[0], rol:(a[3]||'tecnico').toLowerCase()}});
    DB_CLIENTES = cTxt.split('\n').filter(l=>l.trim()&&!l.startsWith('#')).map(l=>{const a=l.split('|'); return {codigo:a[0].trim(), nombre:a.slice(1).join('|').trim()}});
    DB_IMPRESORAS = iTxt.split('\n').filter(l=>l.trim()&&!l.startsWith('#')).map(l=>{const a=l.split('|').map(x=>x.trim()); return {cliente:a[0],codigo:a[1],modelo:a[2],serie:a[3],sucursal:a[4],area:a[5],ubicacion:a[6],bodega:a[7]}});
    DB_TECNICOS = tTxt.split('\n').filter(l=>l.trim()&&!l.startsWith('#')).map(l=>{const a=l.split('|'); return {codigo:a[0].trim(), nombre:a.slice(1).join('|').trim()}});
    DB_BODEGAS = bTxt.split('\n').filter(l=>l.trim()&&!l.startsWith('#')).map(l=>{const a=l.split('|'); return {codigo:a[0].trim(), nombre:a.slice(1).join('|').trim()}});
    DB_TRABAJOS = trTxt.split('\n').filter(l=>l.trim()&&!l.startsWith('#')).map(l=>{const a=l.split('|'); return {codigo:a[0].trim(), nombre:a.slice(1).join('|').trim()}});
    // BODEGA|PRODUCTO|ALTERNO|NOMBRE|SALDO
    DB_INVENTARIOS = invTxt.split('\n').filter(l=>l.trim()&&!l.startsWith('#')).map(l=>{const a=l.split('|').map(x=>x.trim()); return {bodega:a[0], producto:a[1], alterno:a[2], nombre:a[3], saldo:parseInt(a[4]||0)}});

    if(DB_USUARIOS.length===0) throw new Error('usuarios.txt sin usuarios válidos');
    DATOS_LISTOS=true;
    $("loadStatus").innerHTML=`✅ ${DB_USUARIOS.length} usuarios, ${DB_CLIENTES.length} clientes, ${DB_IMPRESORAS.length} impresoras, ${DB_INVENTARIOS.length} inventarios<br><small>Usuarios: ${DB_USUARIOS.map(u=>u.usuario).join(', ')}</small>`;
    $("loadStatus").style.color='#16a34a';
    $("btnLogin").disabled=false;
    $("btnLogin").textContent='Iniciar Sesión';
    $("fallbackFiles").classList.add('hidden');
    if(localStorage.getItem('ecoloimp_session')) iniciar();
  }catch(e){ $("loadStatus").textContent='❌ Error procesando: '+e.message; $("loadStatus").style.color='#dc2626'; }
}

function cargarDesdeInputs(){
  const readFile = (id) => new Promise(res=>{
    const f=$(id).files[0]; if(!f) return res('');
    const rd=new FileReader(); rd.onload=e=>res(e.target.result); rd.readAsText(f);
  });
  Promise.all([readFile('fileUsuarios'),readFile('fileClientes'),readFile('fileImpresoras'),readFile('fileTecnicos')]).then(async ([u,c,i,t])=>{
    // Si no seleccionó alguno, intenta leer los demás que sí seleccionó + inventarios
    const invTxt = await readFile('fileInventarios');
    // usa valores por defecto si faltan
    if(!c) c='00001|CLIENTE DEMO'; if(!i) i='00001|HP009|HP M428|PRN-001|GUAYAQUIL|ADMIN|Oficina|097';
    if(!t) t='T01|Carlos'; if(!u) { alert('Debes seleccionar usuarios.txt'); return; }
    procesarTextos(u,c,i,t,'097|BODEGA MATRIZ','001|PREVENTIVO',invTxt||'097|TON-001|CF258A|TONER HP|15');
  });
}

function login(){
  if(!DATOS_LISTOS) return alert('Espera que carguen los txt o selecciona manualmente');
  const u=$("lgUser").value.trim(), p=$("lgPass").value.trim();
  const ok=DB_USUARIOS.find(x=>x.usuario.toLowerCase()===u.toLowerCase() && x.clave===p);
  if(!ok) return alert('Incorrecto. Usuarios cargados: '+DB_USUARIOS.map(x=>`${x.usuario}/${x.clave}`).join(' | '));
  localStorage.setItem('ecoloimp_session',ok.usuario); localStorage.setItem('ecoloimp_nombre',ok.nombre); localStorage.setItem('ecoloimp_rol',ok.rol);
  iniciar();
}
function iniciar(){
  $("loginPage").classList.add('hidden'); $("app").classList.remove('hidden');
  $("userLabel").textContent=localStorage.getItem('ecoloimp_nombre'); $("userBienvenido").textContent=localStorage.getItem('ecoloimp_nombre');
  $("resumenCarga").textContent=`Cargados ${DB_CLIENTES.length} clientes, ${DB_IMPRESORAS.length} impresoras (estructura: cliente|codigo|modelo|serie|sucursal|area|ubicacion|bodega), ${DB_INVENTARIOS.length} inventarios (BODEGA|PRODUCTO|ALTERNO|NOMBRE|SALDO)`;
  $("dashBody").innerHTML=DB_IMPRESORAS.map(pr=>`<tr><td><b>${pr.serie}</b></td><td>${pr.modelo}<br><small>${pr.codigo}</small></td><td>${pr.cliente} - ${pr.sucursal} / ${pr.area}</td><td>${pr.bodega}</td></tr>`).join('');
}
function logout(){ localStorage.clear(); location.reload(); }
function showPage(p){}

cargarDatosPrimero();

// Failsafe: si en 4 segundos sigue bloqueado, habilita demo
setTimeout(()=>{ if(!DATOS_LISTOS){ $("fallbackFiles").classList.remove('hidden'); $("btnLogin").disabled=false; $("btnLogin").textContent='Entrar (modo demo) - file:// bloquea fetch'; DB_USUARIOS=[{usuario:'admin',clave:'admin123',nombre:'Admin',rol:'admin'}]; DATOS_LISTOS=true; } },4000);

