// ✅ frontend/src/hooks/usePlatformVersionCheck.js — v2.0
// Atualizado em: 28/05/2026
//
// Detecta nova versão da Plataforma Escola da Saúde consultando /version.json sem cache.
// Resolve especialmente navegadores móveis que seguram build antigo, como Samsung Browser.

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "escola_build_version";
const CHECK_INTERVAL_MS = 2 * 60 * 1000;

function normalizarTexto(valor) {
  return String(valor || "").trim();
}

function getBuildSignature(payload) {
  if (!payload || typeof payload !== "object") return null;

  const app = normalizarTexto(payload.app);
  const version = normalizarTexto(payload.version);
  const buildId = normalizarTexto(payload.buildId);
  const buildAt = normalizarTexto(payload.buildAt);

  if (!app && !version && !buildId && !buildAt) return null;

  return [
    app || "app-desconhecido",
    version || "sem-versao",
    buildId || buildAt || "sem-build",
  ].join("::");
}

async function buscarVersaoAtual() {
  const response = await fetch(`/version.json?t=${Date.now()}`, {
    method: "GET",
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Falha ao consultar versão da plataforma: HTTP ${response.status}`
    );
  }

  return response.json();
}

async function atualizarServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();

  await Promise.all(
    registrations.map(async (registration) => {
      try {
        await registration.update();

        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }
      } catch (error) {
        console.warn("[versao-plataforma] falha ao atualizar service worker", {
          message: error?.message,
        });
      }
    })
  );
}

async function limparCachesControlados() {
  if (!("caches" in window)) return;

  const cacheNames = await caches.keys();

  await Promise.all(
    cacheNames
      .filter((name) => {
        const normalized = String(name || "").toLowerCase();

        return (
          normalized.includes("escola") ||
          normalized.includes("vite") ||
          normalized.includes("workbox") ||
          normalized.includes("precache")
        );
      })
      .map((name) => caches.delete(name))
  );
}

export function usePlatformVersionCheck() {
  const [novaVersaoDisponivel, setNovaVersaoDisponivel] = useState(false);
  const [versaoAtual, setVersaoAtual] = useState(null);
  const [versaoNova, setVersaoNova] = useState(null);
  const verificandoRef = useRef(false);

  const verificarVersao = useCallback(async () => {
    if (verificandoRef.current) return;

    verificandoRef.current = true;

    try {
      const payload = await buscarVersaoAtual();
      const assinaturaNova = getBuildSignature(payload);

      if (!assinaturaNova) return;

      const assinaturaSalva = localStorage.getItem(STORAGE_KEY);

      if (!assinaturaSalva) {
        localStorage.setItem(STORAGE_KEY, assinaturaNova);
        setVersaoAtual(payload);
        return;
      }

      setVersaoAtual((atual) => atual || payload);

      if (assinaturaSalva !== assinaturaNova) {
        setVersaoNova(payload);
        setNovaVersaoDisponivel(true);
      }
    } catch (error) {
      console.warn("[versao-plataforma] não foi possível verificar atualização", {
        message: error?.message,
      });
    } finally {
      verificandoRef.current = false;
    }
  }, []);

  const atualizarPlataforma = useCallback(async () => {
    try {
      const payload = await buscarVersaoAtual();
      const assinaturaNova = getBuildSignature(payload);

      if (assinaturaNova) {
        localStorage.setItem(STORAGE_KEY, assinaturaNova);
      }

      await atualizarServiceWorkers();
      await limparCachesControlados();
    } catch (error) {
      console.warn("[versao-plataforma] limpeza controlada incompleta", {
        message: error?.message,
      });
    } finally {
      window.location.reload();
    }
  }, []);

  useEffect(() => {
    verificarVersao();

    const intervalId = window.setInterval(verificarVersao, CHECK_INTERVAL_MS);

    const onFocus = () => verificarVersao();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        verificarVersao();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [verificarVersao]);

  return {
    novaVersaoDisponivel,
    versaoAtual,
    versaoNova,
    verificarVersao,
    atualizarPlataforma,
  };
}