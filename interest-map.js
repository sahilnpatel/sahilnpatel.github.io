(function(){
  const entries={
    ai:{
      kicker:"AI & INTELLIGENT SYSTEMS",
      title:"Machines that can act in the world — Physical AI",
      question:"Machine learning, robotics, autonomous systems, and the hardware that connects them to the physical world.",
      label:"More on my interests",
      href:"interests.html"
    },
    bio:{
      kicker:"COMPUTATIONAL BIOLOGY & MEDICINE",
      title:"Using computation to read biology — Biological AI",
      question:"AI for scientific discovery, bioinformatics, autonomous labs, biological digital twins, molecular design, and personalized medicine.",
      label:"Research & work",
      href:"work.html"
    },
    policy:{
      kicker:"AI SAFETY & POLICY",
      title:"How should AI be governed?",
      question:"Safety evaluation, public policy, technology governance, and the evidence needed to trust powerful systems.",
      label:"Explore AI safety & policy",
      href:"ai-policy.html"
    },
    philosophy:{
      kicker:"PHILOSOPHY & HUMAN PSYCHOLOGY",
      title:"Intelligence, people, and technology",
      question:"Philosophy, cognition, human behavior, and the ways technology changes how we think and live.",
      label:"Explore the quotebook",
      href:"quotes.html"
    },
    innovation:{
      kicker:"ENTREPRENEURSHIP & INNOVATION",
      title:"Making research useful",
      question:"Turning research into tools, products, and companies—and figuring out how to build them with other people.",
      label:"Research & work",
      href:"work.html"
    }
  };
  const mapEl=document.querySelector(".constellation-map");
  const buttons=mapEl&&mapEl.querySelectorAll("[data-interest]");
  const kicker=document.getElementById("curiosity-detail-kicker");
  const title=document.getElementById("curiosity-detail-title");
  const question=document.getElementById("curiosity-detail-question");
  const link=document.getElementById("curiosity-detail-link");
  const detail=document.getElementById("curiosity-detail");
  if(!mapEl||!buttons.length||!kicker||!title||!question||!link)return;
  function select(button){
    const entry=entries[button.dataset.interest];
    if(!entry)return;
    buttons.forEach(item=>item.setAttribute("aria-pressed",String(item===button)));
    mapEl.dataset.active=button.dataset.interest;
    kicker.textContent=entry.kicker;
    title.textContent=entry.title;
    question.textContent=entry.question;
    link.textContent=entry.label;
    link.href=entry.href;
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && typeof detail.animate === "function") {
      detail.animate([{opacity:.62,transform:"translateY(5px)"},{opacity:1,transform:"translateY(0)"}],{duration:180,easing:"ease-out"});
    }
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const openingAnimations = mapEl.querySelectorAll(".opening-signal animateMotion, .opening-signal animate");
  let openingPlayed = false;
  function playOpeningSignal() {
    if (openingPlayed || reducedMotion.matches) return;
    openingPlayed = true;
    openingAnimations.forEach(animation => {
      try { animation.beginElement(); } catch {}
    });
  }
  if (openingAnimations.length) {
    if ("IntersectionObserver" in window) {
      const openingObserver = new IntersectionObserver(items => {
        if (items.some(item => item.isIntersecting)) {
          playOpeningSignal();
          openingObserver.disconnect();
        }
      }, {threshold: .24});
      openingObserver.observe(mapEl);
    } else {
      playOpeningSignal();
    }
  }
  buttons.forEach(button=>button.addEventListener("click",()=>select(button)));
})();