"use client"
import { useState, useEffect } from 'react';
import { db } from "./firebase";
import { collection, addDoc, getDocs, query, orderBy, limit } from "firebase/firestore";

type Country = { code: string; name: string; soldiers: number; base: number; owner: string; flag: string; flagImg: string }

const INITIAL: Country[] = [
  {code:"ZA", name:"South Africa", soldiers:5, base:5, owner:"ZA", flag:"🇿🇦", flagImg:"https://flagcdn.com/w80/za.png"},
  {code:"US", name:"USA", soldiers:9, base:9, owner:"US", flag:"🇺🇸", flagImg:"https://flagcdn.com/w80/us.png"},
  {code:"IN", name:"India", soldiers:9, base:9, owner:"IN", flag:"🇮🇳", flagImg:"https://flagcdn.com/w80/in.png"},
  {code:"VA", name:"Vatican City", soldiers:1, base:1, owner:"VA", flag:"🇻🇦", flagImg:"https://flagcdn.com/w80/va.png"},
  {code:"CN", name:"China", soldiers:9, base:9, owner:"CN", flag:"🇨🇳", flagImg:"https://flagcdn.com/w80/cn.png"},
  {code:"BR", name:"Brazil", soldiers:9, base:9, owner:"BR", flag:"🇧🇷", flagImg:"https://flagcdn.com/w80/br.png"},
  {code:"NG", name:"Nigeria", soldiers:9, base:9, owner:"NG", flag:"🇳🇬", flagImg:"https://flagcdn.com/w80/ng.png"},
  {code:"JP", name:"Japan", soldiers:8, base:8, owner:"JP", flag:"🇯🇵", flagImg:"https://flagcdn.com/w80/jp.png"},
  {code:"DE", name:"Germany", soldiers:8, base:8, owner:"DE", flag:"🇩🇪", flagImg:"https://flagcdn.com/w80/de.png"},
  {code:"IT", name:"Italy", soldiers:5, base:5, owner:"IT", flag:"🇮🇹", flagImg:"https://flagcdn.com/w80/it.png"},
  {code:"IS", name:"Iceland", soldiers:1, base:1, owner:"IS", flag:"🇮🇸", flagImg:"https://flagcdn.com/w80/is.png"},
  {code:"LS", name:"Lesotho", soldiers:2, base:2, owner:"LS", flag:"🇱🇸", flagImg:"https://flagcdn.com/w80/ls.png"},
];

const PLAYERS = INITIAL.map(c=>c.code);
const MY_CODE = "ZA";

const PERSONALITY_MAP: any = {
  'USA': 'Aggressive', 'Brazil': 'Aggressive', 'Nigeria': 'Aggressive',
  'Vatican City': 'Defensive', 'Lesotho': 'Defensive', 'Iceland': 'Defensive',
  'China': 'Opportunist', 'India': 'Opportunist', 'Germany': 'Opportunist',
};
const getPersonality = (name: string) => {
  return PERSONALITY_MAP[name] || 'Opportunist';
};
const difficulty = 'Normal';




function genAICommentary(att: Country, def: Country, attDice: number[], defDice: number[], attLoss: number, defLoss: number) {
  if(attLoss===0 && defLoss===0) return `🤖 TIE! ${att.name} vs ${def.name}! Dice [${attDice}] vs [${defDice}] - No losses!`;
  if(attLoss < defLoss) return `🤖 ${att.name} DOMINATES ${def.name}! Dice ${attDice} vs ${defDice} - ${def.name} loses ${defLoss}!`;
  return `🤖 ${def.name} DEFENDS! Dice ${attDice} vs ${defDice} - ${att.name} loses ${attLoss}!`;
}

export default function Page(){
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // --- VISITOR vs PLAYER ---
const [user, setUser] = useState<any>(null);
const [usernameInput, setUsernameInput] = useState("");
const [showLogin, setShowLogin] = useState(false);
  // --- FIREBASE LEADERBOARD ---
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  async function saveScore(finalScore: number) {
    try {
      const nameToSave = user?.username || usernameInput || "Alizwa";
      await addDoc(collection(db, "scores"), {
        name: nameToSave,
        score: finalScore,
        createdAt: new Date(),
      });
      loadLeaderboard();
    } catch (e) {
      console.log("save failed", e);
    }
  }

  async function loadLeaderboard() {
    try {
      const q = query(collection(db, "scores"), orderBy("score", "desc"), limit(10));
      const snap = await getDocs(q);
      setLeaderboard(snap.docs.map(d => d.data()));
    } catch (e) {
      console.log("load failed", e);
    }
  }
   useEffect(() => { loadLeaderboard(); }, []);


// Check if someone is logged in when page loads
useEffect(() => {
  const saved = localStorage.getItem('risk_user');
  if (saved) setUser(JSON.parse(saved));
}, []);

const handleSignUp = () => {
  if (!usernameInput.trim()) return;
  const newUser = { name: usernameInput.trim(), id: Date.now().toString() };
  localStorage.setItem('risk_user', JSON.stringify(newUser));
  setUser(newUser);
  setShowLogin(false);
  // Fresh game for new player
  setGame(INITIAL);
  setRound(1);
  setTurnIdx(0);
  setLog([`Welcome ${newUser.name}! Your own single-player game has started. You are South Africa.`]);
};

const handleLogout = () => {
  localStorage.removeItem('risk_user');
  setUser(null);
};

const [game, setGame] = useState(() => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('alizwa-game');
    if (saved) return JSON.parse(saved);
  }
  return INITIAL;
});

  const [turnIdx, setTurnIdx] = useState(0);
  const [round, setRound] = useState(1);
  const [selectedAtt, setSelectedAtt] = useState<string|null>(null);
  const [battle, setBattle] = useState<any>(null);
  const [commentary, setCommentary] = useState<string>("Round 1 - Click your flagged country to attack ANY other flagged country! All flags + soldier counts always visible!");
  const [reinforcePool, setReinforcePool] = useState<number|null>(null);
  const [alloc, setAlloc] = useState<Record<string,number>>({});
  const [log, setLog] = useState<string[]>(["Flags now using images - will show on Windows"]);
  const [conquer, setConquer] = useState<any>(null);

  const turnCode = PLAYERS[turnIdx];
  const isMyTurn = turnCode===MY_CODE;

  const handleCountryClick = (code:string) => {
    if(reinforcePool!==null || conquer || battle) return;
    if(!isMyTurn) return;
    const c = game.find(x=>x.code===code)!;
    if(c.owner===MY_CODE){
      setSelectedAtt(code);
      setCommentary(`🎯 ${c.name} selected with ${c.soldiers} soldiers! Click ANY enemy flag image to attack - proximity irrelevant!`);
    } else if(selectedAtt){
      const att = game.find(g=>g.code===selectedAtt)!;
      if(att.soldiers<=1){ setCommentary(`${att.name} needs 2+ soldiers!`); return; }
      const attDiceCount = Math.min(3, att.soldiers-1);
      const defDiceCount = Math.min(2, c.soldiers);
      const attDice = Array.from({length:attDiceCount}, ()=>Math.floor(Math.random()*6)+1).sort((a,b)=>b-a);
      const defDice = Array.from({length:defDiceCount}, ()=>Math.floor(Math.random()*6)+1).sort((a,b)=>b-a);
      let attLoss=0, defLoss=0;
      const comps = Math.min(attDiceCount, defDiceCount);
      for(let i=0;i<comps;i++){ if(attDice[i]>defDice[i]) defLoss++; else if(defDice[i]>attDice[i]) attLoss++; }
      const aiText = genAICommentary(att, c, attDice, defDice, attLoss, defLoss);
      setBattle({att, def:c, attDice, defDice, attLoss, defLoss});
      setCommentary(aiText);
      setTimeout(()=>{
        let newGame = game.map(g=>{
          if(g.code===selectedAtt) return {...g, soldiers: g.soldiers - attLoss};
          if(g.code===code) return {...g, soldiers: g.soldiers - defLoss};
          return g;
        });
        const newDef = newGame.find(g=>g.code===code)!;
        if(newDef.soldiers<=0){
          const reward = Math.max(2, Math.floor(newDef.base/2));
          setConquer({from:selectedAtt, to:code, reward});
          setCommentary(`💥 CONQUERED! ${att.name} takes ${c.name}! Reward ${reward}! ${aiText}`);
          setLog([`CONQUERED ${c.name} - Reward ${reward}`, ...log]);
        }
        setGame(newGame); setBattle(null);
      }, 1500);
    }
  };

  const confirmConquest = () => {
    if(!conquer) return;
    const transfer = Math.max(1, conquer.reward);
    const newGame = game.map(c=>{
      if(c.code===conquer.from) return {...c, soldiers: c.soldiers - transfer + conquer.reward};
      if(c.code===conquer.to) return {...c, owner: MY_CODE, soldiers: transfer};
      return c;
    });
    setGame(newGame); setConquer(null); setSelectedAtt(null);
  };

  // --- NPC BRAIN: plays to win, not random ---
const runNpcTurn = (npcCode: string, board: any[]) => {
  let newBoard = [...board.map(c => ({...c}))];
  let npcLog: string[] = [];
  const npcName = newBoard.find((c: any) => c.owner === npcCode)?.name || '';
const personality = getPersonality(npcName);
const attackBonus = personality === 'Aggressive' ? 2 : personality === 'Defensive' ? 0 : 1;


  // 1. REINFORCEMENTS: put them where they are weakest but can attack
  const myCountries = newBoard.filter(c => c.owner === npcCode);
  const myCount = myCountries.length;
  if (myCount === 0) return { board: newBoard, log: npcLog };
  
  const pool = Math.max(2, myCount * 2) + attackBonus;

  // Find my country with most enemy neighbours that are weaker than me
  let bestReinforce = myCountries[0];
  let bestScore = -999;
  for (const c of myCountries) {
    const enemies = newBoard.filter(o => o.owner !== npcCode);
    // attack score = how many weaker enemies nearby
    // For now, reinforce the country with fewest soldiers (most vulnerable)
    const score = -c.soldiers;
    if (score > bestScore) { bestScore = score; bestReinforce = c; }
  }
  newBoard = newBoard.map(c => c.code === bestReinforce.code ? {...c, soldiers: c.soldiers + pool} : c);
  npcLog.push(`${npcCode} REINFORCES: +${pool} soldiers to ${bestReinforce.name} because it was weakest (${bestReinforce.soldiers} soldiers) and needs defence.`);

  // 2. ATTACK: loop - find BEST attack, not random
  for (let attempt = 0; attempt < 3; attempt++) {
    let bestAttack: any = null;
    let bestAdvantage = 0;

    const mineNow = newBoard.filter(c => c.owner === npcCode && c.soldiers > 1);
    for (const attacker of mineNow) {
      for (const target of newBoard.filter(c => c.owner !== npcCode)) {
        const advantage = attacker.soldiers - target.soldiers;
        // Only attack if I have a clear advantage - playing to WIN
        if (advantage >= 2 && advantage > bestAdvantage) {
          bestAdvantage = advantage;
          bestAttack = { attacker, target, advantage };
        }
      }
    }

    if (!bestAttack) {
      npcLog.push(`${npcCode} STOPS ATTACKING: No target with 2+ soldier advantage - attacking would risk losing soldiers.`);
      break;
    }

    // Do ONE battle roll like player does
    const atkDice = Math.floor(Math.random()*6)+1;
    const defDice = Math.floor(Math.random()*6)+1;
    npcLog.push(`${npcCode} ATTACKS ${bestAttack.target.name} from ${bestAttack.attacker.name} because ${bestAttack.attacker.soldiers} vs ${bestAttack.target.soldiers} = +${bestAttack.advantage} advantage - best chance to win. Dice ${atkDice} vs ${defDice}`);

    if (atkDice > defDice) {
      // Win: take over, move half soldiers
      const move = Math.max(1, Math.floor(bestAttack.attacker.soldiers / 2));
      newBoard = newBoard.map(c => {
        if (c.code === bestAttack.attacker.code) return {...c, soldiers: c.soldiers - move};
        if (c.code === bestAttack.target.code) return {...c, owner: npcCode, soldiers: move};
        return c;
      });
      npcLog.push(`${npcCode} WINS ${bestAttack.target.name}! Moves ${move} soldiers in.`);
    } else {
      // Lose: attacker loses 1
      newBoard = newBoard.map(c => c.code === bestAttack.attacker.code ? {...c, soldiers: Math.max(1, c.soldiers - 1)} : c);
      npcLog.push(`${npcCode} LOSES battle for ${bestAttack.target.name}, loses 1 soldier. Stops to preserve troops.`);
      break; // STOP after a loss - smart play
    }
  }

  // 3. TRANSFER: move soldiers from safe country to weak border country
  const mineAfter = newBoard.filter(c => c.owner === npcCode);
  if (mineAfter.length >= 2) {
    const strongest = [...mineAfter].sort((a,b) => b.soldiers - a.soldiers)[0];
    const weakest = [...mineAfter].sort((a,b) => a.soldiers - b.soldiers)[0];
    if (strongest.soldiers >= 4 && weakest.soldiers <= 2 && strongest.code !== weakest.code) {
      newBoard = newBoard.map(c => {
        if (c.code === strongest.code) return {...c, soldiers: c.soldiers - 1};
        if (c.code === weakest.code) return {...c, soldiers: c.soldiers + 1};
        return c;
      });
      npcLog.push(`${npcCode} TRANSFERS: 1 soldier from ${strongest.name} (${strongest.soldiers}) to ${weakest.name} (${weakest.soldiers}) because ${weakest.name} was too weak to defend.`);
    }
  }

  return { board: newBoard, log: npcLog };
};


  const nextTurn = () => {
  if(reinforcePool!==null || battle) return;
  let nextIdx = (turnIdx+1)%PLAYERS.length;
  let nextRound = round;
  if(nextIdx===0) nextRound++;
  setTurnIdx(nextIdx); setRound(nextRound); setSelectedAtt(null);

  const nextPlayer = PLAYERS[nextIdx];

  // --- NPC TURN ---
  if(nextPlayer !== MY_CODE){
    const result = runNpcTurn(nextPlayer, game);
    setGame(result.board);
    // ADD to log so it stays visible even in fast-forward
    setLog((prev: any) => [...prev, ...result.log]);
    // Give NPC a tiny pause then move to next player automatically?
    // For now, player clicks Skip again to go to next NPC / back to you
    return;
  }

  // --- YOUR TURN ---
  if (nextRound>=2 && nextPlayer===MY_CODE){
  let boardToUse = game;
  const myCount = game.filter((g:any)=>g.owner===MY_CODE).length;
  if (myCount===0){
    boardToUse = game.map((g:any)=> g.name==="South Africa" || g.country==="South Africa" ? {...g, owner: MY_CODE, soldiers: 3} : g);
    setGame(boardToUse);
  }
  }
};


  const confirmReinforce = () => {
    if(reinforcePool===null) return;
    const sum = Object.values(alloc).reduce((a,b)=>a+b,0);
    if(sum!==reinforcePool) return;
    const newGame = game.map(c=> c.owner===MY_CODE && alloc[c.code] ? {...c, soldiers: c.soldiers + alloc[c.code]} : c);
    setGame(newGame); setReinforcePool(null); setAlloc({});
  };

   if (!mounted) {
    return <div style={{ padding: 20 }}>Loading your game, Alizwa... 👑</div>;
  }


  return (
   <div className="min-h-screen bg-slate-900 text-white p-2">
  {!user ? (
  <div style={{background:'#d4edda', color: 'black' ,padding:12, borderRadius:8, marginBottom:12}}>
    👀 You are viewing as a VISITOR - you can watch the game, but you cannot play.
    <button onClick={()=>setShowLogin(true)} style={{marginLeft:8}}>Sign Up / Log In to Play Your Own Game</button>
  </div>
) : (
  <div style={{background:'#fff3cd', color: 'black' , padding:12, borderRadius:8, marginBottom:12}}>
    Welcome, {user.name}! This is YOUR game. <button onClick={handleLogout}>Log Out</button>
  </div>
)}

{showLogin && !user && (
  <div style={{background:'white',color: 'black', padding:12, borderRadius:8, marginBottom:12, border:'1px solid #ccc'}}>
    <b>Sign Up to Start Your Own Game</b><br/>
    <input value={usernameInput} onChange={(e)=>setUsernameInput(e.target.value)} placeholder="Pick a username" style={{padding:8, marginRight:8}} />
    <button onClick={handleSignUp}>Sign Up & Start My Game</button>
  </div>
)}
      <div className="font-bold text-sm">ROUND {round} TURN {turnCode} {isMyTurn? "(YOU)": ""}</div>
      <div className="bg-blue-900 border-2 border-yellow-400 p-2 my-2 rounded">
        <div className="text-yellow-300 font-bold text-xs">AI BATTLE COMMENTARY:</div>
        <div className="text-white text-sm">{commentary}</div>
        {battle && (
          <div className="mt-2 flex gap-3 bg-black/60 p-2 rounded animate-pulse">
            <div className="flex items-center gap-1"><img src={battle.att.flagImg} className="w-6 h-4 object-cover" /> {battle.attDice.map((d:number)=>`🎲${d}`).join(' ')}</div>
            <div className="flex items-center gap-1"><img src={battle.def.flagImg} className="w-6 h-4 object-cover" /> {battle.defDice.map((d:number)=>`🎲${d}`).join(' ')}</div>
            <div className="text-red-300">Loss -{battle.attLoss}/-{battle.defLoss} {battle.attLoss===0&&battle.defLoss===0?"TIE=0":""}</div>
          </div>
        )}
      </div>

      {reinforcePool!==null && (
        <div className="bg-blue-600 p-2 rounded mb-2">
          <div>You control {game.filter(g=>g.owner===MY_CODE).length} flags - you get {reinforcePool} soldiers</div>
          <div className="flex gap-2 mt-1 flex-wrap">
            {game.filter(g=>g.owner===MY_CODE).map(c=>(
              <div key={c.code} className="bg-black/50 p-1 rounded text-center">
                <img src={c.flagImg} className="w-8 h-5 mx-auto" /><div className="text-xs">{c.name} ({c.soldiers})</div>
                <input type="number" className="text-black w-14" value={alloc[c.code]||0} onChange={e=>setAlloc({...alloc, [c.code]: parseInt(e.target.value)||0})} />
              </div>
            ))}
          </div>
          <button onClick={confirmReinforce} className="bg-gradient-to-r from-emerald-400 to-green-500 text-white font-bold px-5 py-2.5 rounded-full shadow-lg shadow-emerald-500/30 hover:scale-105 active:scale-95 transition-all mt-1">Confirm Allocation - {Object.values(alloc).reduce((a,b)=>a+b,0)}/{reinforcePool}</button>
        </div>
      )}

      {conquer && <div className="bg-green-700 p-2 rounded mb-2">CONQUERED {conquer.to} - Reward {conquer.reward} <button onClick={confirmConquest} className="bg-white text-black px-2 rounded ml-2">Confirm Transfer</button></div>}

      <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'8px', marginTop:'8px'}}>
        {game.map(c=>(
          <div key={c.code} onClick={()=>handleCountryClick(c.code)} style={{background: c.owner==='ZA' ? '#1e40af' : '#1f2937', border: c.owner==='ZA' ? '3px solid #facc15' : '1px solid #475569', borderRadius:'12px', padding:'10px', textAlign:'center', cursor:'pointer', color:'white'}}>
            <img src={c.flagImg} alt={c.name} className="w-12 h-8 object-cover mx-auto rounded shadow" />
            <div className="font-bold text-[11px] mt-1">{c.name}</div>
            <div className="font-extrabold text-lg">{c.soldiers} soldiers</div>
            <div className="text-[10px] opacity-80">Base {c.base} | {c.owner}</div>
            <div className="text-[10px]">{getPersonality(c.name) === 'Aggressive' ? '🔴 Aggressive' : getPersonality(c.name) === 'Defensive' ? '🛡️ Defensive' : '🎲 Opportunist'}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-3">
        <button onClick={nextTurn} className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold px-5 py-2.5 rounded-full shadow-lg shadow-fuchsia-500/30 hover:scale-105 active:scale-95 transition-all">Skip Turn Round {round}</button>
        <div className="text-xs bg-black/30 p-1 rounded max-h-20 overflow-auto w-80">{log.map((l,i)=><div key={i}>{l}</div>)}</div>
      </div>
            {/* --- LEADERBOARD --- */}
      <div className="mt-4 p-4 bg-black/30 rounded">
        <h2 className="font-bold text-lg">🏆 Top 10 Leaderboard</h2>
        <button
    onClick={() => {
  const myCount = game.filter((c: any) => c.owner === "ZA").length;
  saveScore(myCount);
  alert("Saved! You own " + myCount + " countries");
}}

          className="bg-yellow-500 text-black px-4 py-2 rounded font-bold mt-2"
        >
          Save My Score
        </button>
        <div className="mt-3">
          {leaderboard.map((entry: any, i: number) => (
            <div key={i} className="flex justify-between">
              <span>{i + 1}. {entry.name}</span>
              <span>{entry.score} countries</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
