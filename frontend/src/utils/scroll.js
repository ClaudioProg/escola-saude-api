// 📁 src/utils/scroll.js
export function lockScroll() {
    const html = document.documentElement;
    const body = document.body;
    if (!body) return;
    const scrollY = window.scrollY || window.pageYOffset || 0;
  
    body.dataset.prevTop = String(scrollY);
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    html.classList.add("overflow-hidden");
    body.classList.add("overflow-hidden", "no-scroll", "modal-open");
  }
  
  export function unlockScroll() {
    const html = document.documentElement;
    const body = document.body;
    if (!body) return;
  
    const prevTop = parseInt(body.dataset.prevTop || "0", 10) || 0;
  
    html.classList.remove("overflow-hidden");
    body.classList.remove("overflow-hidden", "no-scroll", "modal-open");
    body.style.position = "";
    body.style.top = "";
    body.style.left = "";
    body.style.right = "";
    body.style.width = "";
    delete body.dataset.prevTop;
  
    try {
      window.scrollTo({ top: prevTop, behavior: "instant" });
    } catch {
      window.scrollTo(0, prevTop);
    }
  }
  