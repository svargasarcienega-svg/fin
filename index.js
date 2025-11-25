// === Firebase (CDN Modular) ===
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  updateDoc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// === TU CONFIG ===
const firebaseConfig = {
  apiKey: "AIzaSyDjSsmrOT7huC-HBZIiM3FkrjBBkw-TVGQ",
  authDomain: "proyecto-3-en-raya.firebaseapp.com",
  projectId: "proyecto-3-en-raya",
  storageBucket: "proyecto-3-en-raya.firebasestorage.app",
  messagingSenderId: "252069733137",
  appId: "1:252069733137:web:b8b96d435700e1c49962b0"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// === DOM ===
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const btnRegister = document.getElementById("btnRegister");
const btnLogin = document.getElementById("btnLogin");
const btnLogout = document.getElementById("btnLogout");

const btnCrearPartida = document.getElementById("btnCrearPartida");
const btnUnirsePartida = document.getElementById("btnUnirsePartida");
const btnVerPartida = document.getElementById("btnVerPartida");
const codigoPartida = document.getElementById("codigoPartida");

const panelPartida = document.getElementById("panelPartida");
const pid = document.getElementById("pid");
const pestado = document.getElementById("pestado");
const pturno = document.getElementById("pturno");
const px = document.getElementById("px");
const po = document.getElementById("po");
const pganador = document.getElementById("pganador");
const tableroDiv = document.getElementById("tablero");

const btnReiniciar = document.getElementById("btnReiniciar");           
const btnAceptarReinicio = document.getElementById("btnAceptarReinicio"); 

const estadoAuth = document.getElementById("estadoAuth");
const mensaje = document.getElementById("mensaje");

// === Estado global ===
let currentUser = null;
let partidaId = null;
let partidaRef = null;
let miSimbolo = null;
let stopListener = null;

// === Helpers UI ===
function setMsg(texto, tipo = "") {
  if (!mensaje) return;
  mensaje.className = "";
  if (tipo) mensaje.classList.add(tipo);
  mensaje.textContent = texto || "";
}

// === Auth ===
onAuthStateChanged(auth, (user) => {
  currentUser = user || null;
  estadoAuth.textContent = user ? "conectado" : "desconectado";

  const habilitar = !!user;
  btnCrearPartida.disabled = !habilitar;
  btnUnirsePartida.disabled = !habilitar;
  btnLogout.disabled = !habilitar;
});

btnRegister.addEventListener("click", async () => {
  try {
    await createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
    setMsg("Usuario registrado", "ok");
  } catch (e) {
    setMsg("Error: " + e.message, "err");
  }
});

btnLogin.addEventListener("click", async () => {
  try {
    await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
    setMsg("Sesión iniciada", "ok");
  } catch (e) {
    setMsg("Error: " + e.message, "err");
  }
});

btnLogout.addEventListener("click", async () => {
  try {
    await signOut(auth);
    setMsg("Sesión cerrada", "ok");
  } catch (e) {
    setMsg("Error: " + e.message, "err");
  }
});

// === Crear partida (creador = X) ===
btnCrearPartida.addEventListener("click", async () => {
  if (!currentUser) return setMsg("Inicia sesión primero.", "warn");

  const partida = {
    estado: "waiting",
    turno: "X",
    tablero: ["", "", "", "", "", "", "", "", ""],
    jugadores: { X: currentUser.email, O: null },
    ganador: null,
    revancha: null, 
    creadaEn: serverTimestamp()
  };

  try {
    const docRef = await addDoc(collection(db, "partidas"), partida);
    partidaId = docRef.id;
    miSimbolo = "X";
    cargarPartida(partidaId);
    // ✅ Mostrar el ID claramente
    setMsg(`✅ Partida creada. ID: ${partidaId}`, "ok");
    // Opcional: copiar al portapapeles
    navigator.clipboard?.writeText(partidaId).catch(() => {});
  } catch (e) {
    console.error("Error al crear partida:", e);
    setMsg("Error al crear partida: " + e.message, "err");
  }
});

// === Unirse a partida (entra como O) ===
btnUnirsePartida.addEventListener("click", async () => {
  if (!currentUser) return setMsg("Inicia sesión primero.", "warn");
  const id = (codigoPartida.value || "").trim();
  if (!id) return setMsg("Escribe un ID de partida.", "warn");

  const ref = doc(db, "partidas", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return setMsg("Partida no encontrada.", "err");

  const partida = snap.data();
  if (partida.jugadores.O) return setMsg("La partida ya está llena.", "warn");

  await updateDoc(ref, {
    jugadores: { ...partida.jugadores, O: currentUser.email },
    estado: "playing"
  });

  partidaId = id;
  miSimbolo = "O";
  cargarPartida(id);
  setMsg("Te uniste como O.", "ok");
});

// === Ver partida (modo espectador o jugador ya dentro) ===
btnVerPartida.addEventListener("click", () => {
  const id = (codigoPartida.value || "").trim();
  if (!id) return setMsg("Escribe un ID de partida.", "warn");
  partidaId = id;
  cargarPartida(id);
});

// === Escuchar/Renderizar partida ===
function cargarPartida(id) {
  if (stopListener) { stopListener(); stopListener = null; }

  tableroDiv.innerHTML = "";
  pganador.textContent = "—";
  panelPartida.style.display = "block";
  partidaRef = doc(db, "partidas", id);

  stopListener = onSnapshot(
    partidaRef,
    (snap) => {
      if (!snap.exists()) {
        setMsg("Partida no encontrada.", "err");
        return;
      }
      const partida = snap.data();
      pid.textContent = id;
      pestado.textContent = partida.estado || "—";
      pturno.textContent = partida.turno || "—";
      px.textContent = partida.jugadores?.X || "—";
      po.textContent = partida.jugadores?.O || "—";
      pganador.textContent = partida.ganador || "—";

      if (currentUser) {
        if (partida.jugadores?.X === currentUser.email) miSimbolo = "X";
        else if (partida.jugadores?.O === currentUser.email) miSimbolo = "O";
        else miSimbolo = null;
      }

      renderTablero(partida.tablero || [], partida);

      btnReiniciar.style.display =
        partida.estado === "ended" && (!partida.revancha || !partida.revancha.activa)
          ? "inline-block"
          : "none";

      const soyJugador = [partida.jugadores?.X, partida.jugadores?.O].includes(currentUser?.email);
      const soySolicitante = partida.revancha?.solicitante === currentUser?.email;
      const yaConfirme = (partida.revancha?.confirmaciones || []).includes(currentUser?.email);

      btnAceptarReinicio.style.display =
        partida.estado === "ended" &&
        partida.revancha?.activa &&
        soyJugador &&
        !soySolicitante &&
        !yaConfirme
          ? "inline-block"
          : "none";

      if (partida.revancha?.nuevaId && partida.revancha.nuevaId !== partidaId) {
        partidaId = partida.revancha.nuevaId;
        cargarPartida(partidaId);
      }
    },
    (err) => {
      console.error("Error en onSnapshot:", err);
      setMsg("Error al escuchar partida: " + err.message, "err");
    }
  );
}

function renderTablero(tablero, partida) {
  tableroDiv.innerHTML = "";
  tablero.forEach((valor, i) => {
    const celda = document.createElement("div");
    celda.className = "celda";
    if (valor === "X") celda.classList.add("x");
    if (valor === "O") celda.classList.add("o");
    celda.textContent = valor;

    celda.addEventListener("click", async () => {
      if (!currentUser) return;
      if (partida.estado !== "playing") return;
      if (partida.turno !== miSimbolo) return;
      if (tablero[i]) return;

      const nuevoTablero = [...tablero];
      nuevoTablero[i] = miSimbolo;
      const ganador = verificarGanador(nuevoTablero);
      await updateDoc(partidaRef, {
        tablero: nuevoTablero,
        turno: miSimbolo === "X" ? "O" : "X",
        estado: ganador ? "ended" : "playing",
        ganador: ganador
      });
    });
    tableroDiv.appendChild(celda);
  });
}

function verificarGanador(t) {
  const c = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  for (const [a,b, cx] of c) {
    if (t[a] && t[a] === t[b] && t[a] === t[cx]) return t[a];
  }
  return t.includes("") ? null : "Empate";
}

// === Revancha: enviar solicitud ===
btnReiniciar.addEventListener("click", async () => {
  if (!currentUser || !partidaRef) return;

  const snap = await getDoc(partidaRef);
  if (!snap.exists()) return;
  const partida = snap.data();
  if (partida.estado !== "ended") return;

  const soyJugador = [partida.jugadores?.X, partida.jugadores?.O].includes(currentUser.email);
  if (!soyJugador) return setMsg("Solo los jugadores pueden solicitar revancha.", "warn");

  await updateDoc(partidaRef, {
    revancha: {
      solicitante: currentUser.email,
      confirmaciones: [currentUser.email],
      activa: true,
      nuevaId: null,
      ts: serverTimestamp()
    }
  });
  setMsg("Solicitud enviada. Esperando aceptación del otro jugador…", "ok");
});

// === Revancha: aceptar ===
btnAceptarReinicio.addEventListener("click", async () => {
  if (!currentUser || !partidaRef) return;

  const snap = await getDoc(partidaRef);
  if (!snap.exists()) return;
  const partida = snap.data();

  if (!partida.revancha?.activa) return;
  const soyJugador = [partida.jugadores?.X, partida.jugadores?.O].includes(currentUser.email);
  if (!soyJugador) return setMsg("Solo los jugadores pueden aceptar.", "warn");

  await updateDoc(partidaRef, {
    "revancha.confirmaciones": arrayUnion(currentUser.email)
  });

  const snap2 = await getDoc(partidaRef);
  const p2 = snap2.data();
  const confs = p2.revancha?.confirmaciones || [];
  const ambosConfirmaron = [p2.jugadores?.X, p2.jugadores?.O].every(e => confs.includes(e));

  if (ambosConfirmaron) {
    const nuevaPartida = {
      estado: "playing",
      turno: "X",
      tablero: ["", "", "", "", "", "", "", "", ""],
      jugadores: { X: p2.jugadores.O, O: p2.jugadores.X },
      ganador: null,
      revancha: null,
      creadaEn: serverTimestamp()
    };

    const nuevaRef = await addDoc(collection(db, "partidas"), nuevaPartida);
    await updateDoc(partidaRef, {
      "revancha.nuevaId": nuevaRef.id,
      "revancha.activa": false
    });
    cargarPartida(nuevaRef.id);
    setMsg("¡Nueva partida creada! Se alternaron los roles.", "ok");
  } else {
    setMsg("Aceptaste. Esperando al otro jugador…", "ok");
  }
});