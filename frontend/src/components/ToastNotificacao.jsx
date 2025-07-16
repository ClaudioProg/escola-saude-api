import { toast } from "react-toastify";
import { CheckCircle, XCircle, Info, AlertTriangle } from "lucide-react";

// 🔔 Notificação de sucesso
export function toastSucesso(mensagem = "Ação concluída com sucesso!") {
  toast.success(mensagem, {
    icon: <CheckCircle size={20} className="text-green-600" />,
    position: "top-right",
    autoClose: 4000,
    theme: "light",
  });
}

// ❌ Notificação de erro
export function toastErro(mensagem = "Ocorreu um erro ao processar.") {
  toast.error(mensagem, {
    icon: <XCircle size={20} className="text-red-600" />,
    position: "top-right",
    autoClose: 5000,
    theme: "light",
  });
}

// ⚠️ Notificação de aviso
export function toastAlerta(mensagem = "Atenção! Verifique os dados.") {
  toast.warn(mensagem, {
    icon: <AlertTriangle size={20} className="text-yellow-600" />,
    position: "top-right",
    autoClose: 5000,
    theme: "light",
  });
}

// ℹ️ Notificação informativa
export function toastInfo(mensagem = "Informação útil.") {
  toast.info(mensagem, {
    icon: <Info size={20} className="text-blue-600" />,
    position: "top-right",
    autoClose: 5000,
    theme: "light",
  });
}
