(function(){
  const entries={
    ai:{kicker:"01 · BUILD",title:"AI & intelligent systems",question:"How can AI and robotics help us understand and shape the physical world?",label:"Explore these interests →",href:"interests.html"},
    bio:{kicker:"02 · DISCOVER",title:"Computational biology & medicine",question:"Can AI help us read biology more deeply and make medicine more personal?",label:"See research & work →",href:"work.html"},
    policy:{kicker:"03 · STEWARD",title:"AI safety & governance",question:"What evidence and oversight should earn trust in a powerful AI system?",label:"Read AI policy notes →",href:"ai-policy.html"},
    philosophy:{kicker:"04 · UNDERSTAND",title:"Philosophy & human psychology",question:"What do intelligence and human behavior reveal about how technology fits into our lives?",label:"Read philosophy notes →",href:"philosophy.html"},
    innovation:{kicker:"05 · MAKE",title:"Entrepreneurship & innovation",question:"How do promising research ideas become useful tools, products, or companies?",label:"Explore research & work →",href:"work.html"}
  };
  const map=document.querySelector(".constellation-map");
  const buttons=map&&map.querySelectorAll("[data-interest]");
  const kicker=document.getElementById("curiosity-detail-kicker");
  const title=document.getElementById("curiosity-detail-title");
  const question=document.getElementById("curiosity-detail-question");
  const link=document.getElementById("curiosity-detail-link");
  if(!map||!buttons.length||!kicker||!title||!question||!link)return;
  function select(button){
    const entry=entries[button.dataset.interest];
    if(!entry)return;
    buttons.forEach(item=>item.setAttribute("aria-pressed",String(item===button)));
    map.dataset.active=button.dataset.interest;
    kicker.textContent=entry.kicker;
    title.textContent=entry.title;
    question.textContent=entry.question;
    link.textContent=entry.label;
    link.href=entry.href;
  }
  buttons.forEach(button=>button.addEventListener("click",()=>select(button)));
})();