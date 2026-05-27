// ✅ src/components/layout/MenuLink.jsx — v2.0
// Plataforma Escola da Saúde
//
// Link oficial de navegação da plataforma.
//
// Revisão premium:
// - pertence ao domínio layout;
// - usado por menus, sidebar, topbar e navegação estrutural;
// - contrato oficial em português;
// - sem aliases;
// - sem compatibilidade legada;
// - sem classes livres para sobrescrever estado crítico;
// - suporte a rota interna via NavLink;
// - suporte controlado a link externo;
// - suporte a badge/ministat contextual;
// - suporte a modo recolhido;
// - acessível com aria-current, aria-disabled e foco visível;
// - visual premium consistente com SidebarNav v2.0.

import { cloneElement, createElement, forwardRef, isValidElement } from "react";
import PropTypes from "prop-types";
import { ExternalLink } from "lucide-react";
import { NavLink } from "react-router-dom";

const TOM_CLASSES = {
  escuro: {
    base:
      "text-white/88 hover:bg-white/10 hover:text-white focus-visible:ring-white/45",
    ativo:
      "bg-white/14 text-white shadow-[0_12px_38px_-28px_rgba(0,0,0,0.8)] ring-1 ring-white/12",
    pendente: "opacity-80",
    badge:
      "bg-white/16 text-white ring-white/20",
  },
  claro: {
    base:
      "text-slate-700 hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-emerald-500 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white",
    ativo:
      "bg-emerald-50 text-emerald-950 ring-1 ring-emerald-200 dark:bg-emerald-950/35 dark:text-emerald-100 dark:ring-emerald-900/60",
    pendente: "opacity-80",
    badge:
      "bg-emerald-100 text-emerald-950 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-100 dark:ring-emerald-900/60",
  },
  solido: {
    base:
      "bg-white/10 text-white hover:bg-white/16 hover:text-white ring-1 ring-white/10 focus-visible:ring-white/50",
    ativo:
      "bg-white/18 text-white shadow-[0_14px_42px_-30px_rgba(0,0,0,0.85)] ring-1 ring-white/18",
    pendente: "opacity-80",
    badge:
      "bg-white/18 text-white ring-white/25",
  },
};

const TAMANHO_CLASSES = {
  sm: {
    root: "min-h-9 px-3 py-2 text-sm",
    icone: "h-4 w-4",
    badge: "min-w-5 px-1.5 py-0.5 text-[10px]",
  },
  md: {
    root: "min-h-10 px-3.5 py-2.5 text-sm",
    icone: "h-5 w-5",
    badge: "min-w-6 px-2 py-0.5 text-[11px]",
  },
  lg: {
    root: "min-h-11 px-4 py-3 text-base",
    icone: "h-5 w-5",
    badge: "min-w-6 px-2 py-0.5 text-[11px]",
  },
};

const FORMATO_CLASSES = {
  arredondado: "rounded-2xl",
  pilula: "rounded-full",
  discreto: "rounded-xl",
};

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function isExternalHref(rota) {
  return typeof rota === "string" && /^(https?:|mailto:|tel:)/i.test(rota);
}

function resolveRel({ rel, novaAba }) {
  if (rel) return rel;
  return novaAba ? "noopener noreferrer" : undefined;
}

function renderIcon(icone, className) {
  if (!icone) return null;

  if (isValidElement(icone)) {
    return cloneElement(icone, {
      className: classNames(className, icone.props?.className),
      "aria-hidden": icone.props?.["aria-hidden"] ?? true,
      focusable: icone.props?.focusable ?? "false",
    });
  }

  if (typeof icone === "function") {
    return createElement(icone, {
      className,
      "aria-hidden": true,
      focusable: "false",
    });
  }

  return null;
}

function formatarBadge(valor) {
  const numero = Number(valor);

  if (!Number.isFinite(numero) || numero <= 0) {
    return "";
  }

  return numero > 99 ? "99+" : String(numero);
}

function BadgeMenu({ valor, recolhido, label, className }) {
  const texto = formatarBadge(valor);

  if (!texto) return null;

  if (recolhido) {
    return (
      <span
        className={classNames(
          "absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-black leading-none text-white ring-2 ring-white dark:ring-slate-950",
          className
        )}
        aria-label={label}
        title={label}
      >
        {texto}
      </span>
    );
  }

  return (
    <span
      className={classNames(
        "ml-auto inline-flex shrink-0 items-center justify-center rounded-full font-black ring-1",
        className
      )}
      aria-label={label}
      title={label}
    >
      {texto}
    </span>
  );
}

const MenuLink = forwardRef(function MenuLink(
  {
    rota,
    icone,
    iconeDireita,
    children,
    exato = false,
    tom = "claro",
    tamanho = "md",
    formato = "arredondado",
    desabilitado = false,
    novaAba = false,
    rel,
    titulo,
    aoClicar,
    tabIndex,
    recolhido = false,
    badge,
    badgeLabel,
    className = "",
    "aria-label": ariaLabel,
    ...props
  },
  ref
) {
  const externo = isExternalHref(rota);
  const theme = TOM_CLASSES[tom] || TOM_CLASSES.claro;
  const size = TAMANHO_CLASSES[tamanho] || TAMANHO_CLASSES.md;
  const formatoClass = FORMATO_CLASSES[formato] || FORMATO_CLASSES.arredondado;

  const labelAcessivel =
    ariaLabel ||
    titulo ||
    (typeof children === "string" ? children : undefined);

  const badgeText = formatarBadge(badge);
  const badgeAriaLabel =
    badgeLabel ||
    (badgeText && labelAcessivel
      ? `${labelAcessivel}: ${badgeText} item(ns) relevante(s)`
      : undefined);

  const iconeEsquerda = renderIcon(
    icone,
    classNames(size.icone, "shrink-0")
  );

  const iconeFinal =
    iconeDireita ||
    (externo && novaAba ? ExternalLink : null);

  const iconeDireitaRenderizado = renderIcon(
    iconeFinal,
    classNames(size.icone, "ml-auto shrink-0 opacity-80")
  );

  const baseClassName = classNames(
    "group relative inline-flex w-full items-center gap-2 overflow-hidden font-black transition",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
    "select-none",
    formatoClass,
    size.root,
    theme.base,
    recolhido && "justify-center px-2",
    desabilitado && "pointer-events-none cursor-not-allowed opacity-55",
    className
  );

  const content = (
    <>
      <span
        className={classNames(
          "relative inline-flex shrink-0 items-center justify-center",
          recolhido && "h-5 w-5"
        )}
      >
        {iconeEsquerda}

        {recolhido && badgeText && (
          <BadgeMenu
            valor={badge}
            recolhido
            label={badgeAriaLabel}
          />
        )}
      </span>

      {!recolhido && (
        <>
          <span className="min-w-0 flex-1 truncate text-left">
            {children}
          </span>

          <BadgeMenu
            valor={badge}
            recolhido={false}
            label={badgeAriaLabel}
            className={classNames(size.badge, theme.badge)}
          />

          {iconeDireitaRenderizado}
        </>
      )}
    </>
  );

  if (desabilitado) {
    return (
      <span
        ref={ref}
        role="link"
        aria-disabled="true"
        data-disabled="true"
        tabIndex={-1}
        className={baseClassName}
        title={titulo}
        aria-label={labelAcessivel}
        {...props}
      >
        {content}
      </span>
    );
  }

  if (externo) {
    return (
      <a
        ref={ref}
        href={rota}
        target={novaAba ? "_blank" : undefined}
        rel={resolveRel({ rel, novaAba })}
        className={baseClassName}
        aria-label={labelAcessivel}
        title={titulo}
        onClick={aoClicar}
        tabIndex={tabIndex}
        data-external="true"
        {...props}
      >
        {content}
      </a>
    );
  }

  return (
    <NavLink
      ref={ref}
      to={rota}
      end={exato}
      aria-label={badgeAriaLabel || labelAcessivel}
      title={titulo}
      onClick={aoClicar}
      tabIndex={tabIndex}
      className={({ isActive, isPending }) =>
        classNames(
          baseClassName,
          isActive && theme.ativo,
          isPending && theme.pendente
        )
      }
      {...props}
    >
      {content}
    </NavLink>
  );
});

BadgeMenu.propTypes = {
  valor: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  recolhido: PropTypes.bool,
  label: PropTypes.string,
  className: PropTypes.string,
};

MenuLink.propTypes = {
  rota: PropTypes.string.isRequired,
  icone: PropTypes.oneOfType([PropTypes.elementType, PropTypes.element]),
  iconeDireita: PropTypes.oneOfType([PropTypes.elementType, PropTypes.element]),
  children: PropTypes.node.isRequired,
  exato: PropTypes.bool,
  tom: PropTypes.oneOf(["escuro", "claro", "solido"]),
  tamanho: PropTypes.oneOf(["sm", "md", "lg"]),
  formato: PropTypes.oneOf(["arredondado", "pilula", "discreto"]),
  desabilitado: PropTypes.bool,
  novaAba: PropTypes.bool,
  rel: PropTypes.string,
  titulo: PropTypes.string,
  aoClicar: PropTypes.func,
  tabIndex: PropTypes.number,
  recolhido: PropTypes.bool,
  badge: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  badgeLabel: PropTypes.string,
  className: PropTypes.string,
  "aria-label": PropTypes.string,
};

export default MenuLink;