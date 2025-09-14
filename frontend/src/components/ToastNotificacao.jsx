// 📁 src/components/toastNotificacao.js
import { toast } from "react-toastify";
import { CheckCircle, XCircle, Info, AlertTriangle } from "lucide-react";

/**
 * Helper genérico para criar toasts.
 */
function toastCustom(type, mensagem, icon, autoClose = 5000, theme = "light") {
  toast[type](mensagem, {
    icon,
    position: "top-right",
    autoClose,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    hideProgressBar: false,
    theme,
  });
}

// 🔔 Notificação de sucesso
export function toastSucesso(mensagem = "Ação concluída com sucesso!", autoClose = 4000, theme = "light") {
  toastCustom("success", mensagem, <CheckCircle size={20} className="text-green-600" />, autoClose, theme);
}

// ❌ Notificação de erro
export function toastErro(mensagem = "Ocorreu um erro ao processar.", autoClose = 5000, theme = "light") {
  toastCustom("error", mensagem, <XCircle size={20} className="text-red-600" />, autoClose, theme);
}

// ⚠️ Notificação de aviso
export function toastAlerta(mensagem = "Atenção! Verifique os dados.", autoClose = 5000, theme = "light") {
  toastCustom("warn", mensagem, <AlertTriangle size={20} className="text-yellow-600" />, autoClose, theme);
}

// ℹ️ Notificação informativa
export function toastInfo(mensagem = "Informação útil.", autoClose = 5000, theme = "light") {
  toastCustom("info", mensagem, <Info size={20} className="text-blue-600" />, autoClose, theme);
}
