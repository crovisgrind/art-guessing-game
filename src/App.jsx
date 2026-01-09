import { useEffect, useMemo, useState } from "react"
import { paintings } from "./paintings"

const GRID = 6
const TILES = 36
const MAX_GUESSES = 6

const keyboardLayout = [
  ["Q","W","E","R","T","Y","U","I","O","P"],
  ["A","S","D","F","G","H","J","K","L"],
  ["ENTER","Z","X","C","V","B","N","M","⌫"]
]

const normalize = t =>
  t.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Z]/gi,"").toUpperCase()

const isLetter = c => /^[A-Z]$/.test(c)

function getDailyPainting(){
  const start=new Date(2024,0,1)
  const today=new Date()
  const diff=Math.floor((today-start)/(1000*60*60*24))
  return paintings[diff%paintings.length]
}

export default function App(){
  const painting=getDailyPainting()
  const target=painting.artist
  const normTarget=normalize(target)

  const pattern=useMemo(()=>target.split("").map(c=>isLetter(normalize(c))?null:c),[target])
  const slots=pattern.filter(x=>x===null).length

  const [rows,setRows]=useState([])
  const [current,setCurrent]=useState(pattern.map(c=>c||""))
  const [keyboard,setKeyboard]=useState({})
  const [status,setStatus]=useState("playing")

  const [tilePool]=useState([...Array(TILES).keys()].sort(()=>Math.random()-0.5))
  const [revealed,setRevealed]=useState([tilePool[0]])

  const revealTile=()=>{
    setRevealed(r=>{
      if(r.length>=tilePool.length)return r
      return [...r,tilePool[r.length]]
    })
  }

  const type=l=>{
    if(status!=="playing")return
    const i=current.findIndex((c,idx)=>pattern[idx]===null&&!c)
    if(i!==-1){
      const n=[...current];n[i]=l;setCurrent(n)
    }
  }

  const backspace=()=>{
    const idx=[...current].map((c,i)=>pattern[i]===null&&c?i:-1).filter(i=>i!==-1).pop()
    if(idx!==undefined){
      const n=[...current];n[idx]="";setCurrent(n)
    }
  }

  const submit=()=>{
    const letters=current.filter((c,i)=>pattern[i]===null).join("")
    if(letters.length!==slots)return

    const g=normalize(letters)
    const t=normTarget.split("")
    const a=g.split("")

    const res=Array(slots).fill("absent")
    const cnt={}
    t.forEach((c,i)=>{if(a[i]===c)res[i]="correct";else cnt[c]=(cnt[c]||0)+1})
    a.forEach((c,i)=>{if(res[i]==="correct")return;if(cnt[c]){res[i]="present";cnt[c]--}})

    let k=0
    const full=pattern.map(p=>p? "skip":res[k++])

    setRows(r=>[...r,{letters:[...current],result:full}])

    const kb={...keyboard}
    a.forEach((c,i)=>{if(kb[c]!=="correct")kb[c]=res[i]})
    setKeyboard(kb)

    if(g===normTarget){
      if(navigator.vibrate)navigator.vibrate([40,40,80])
      setStatus("won")
      setRevealed(tilePool)
      return
    }

    revealTile()
    if(navigator.vibrate)navigator.vibrate(20)

    if(rows.length+1>=MAX_GUESSES)setStatus("lost")

    setCurrent(pattern.map(c=>c||""))
  }

  const handle=k=>{
    if(k==="ENTER")submit()
    else if(k==="⌫")backspace()
    else if(isLetter(k))type(k)
  }

  return(
    <div style={{minHeight:"100dvh",background:"#0f0f0f",color:"#fff",padding:12}}>
      <style>{`
        .tile-wrap{perspective:800px}
        .tile{width:100%;height:100%;position:relative;transform-style:preserve-3d;transition:transform .6s}
        .tile.revealed{transform:rotateY(180deg)}
        .tile-face{position:absolute;inset:0;backface-visibility:hidden;border-radius:6px}
        .tile-back{background:#111}
        .tile-front{transform:rotateY(180deg);overflow:hidden}
        .key:active{transform:scale(.94)}
      `}</style>

      <h1 style={{textAlign:"center"}}>🎨 Art Guess</h1>

      {/* TILE GRID */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:4,maxWidth:360,margin:"auto"}}>
        {[...Array(36)].map((_,i)=>(
          <div key={i} className="tile-wrap">
            <div className={`tile ${revealed.includes(i)?"revealed":""}`}>
              <div className="tile-face tile-back"/>
              <div className="tile-face tile-front">
                <img src={painting.image} style={{
                  width:"600%",
                  height:"600%",
                  objectFit:"cover",
                  objectPosition:`${(i%6)*20}% ${Math.floor(i/6)*20}%`
                }}/>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* WORDLE GRID */}
      <div style={{marginTop:16}}>
        {rows.map((r,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"center",gap:4}}>
            {r.letters.map((c,j)=>(
              <div key={j} style={{
                width:32,height:40,
                background:r.result[j]==="correct"?"#22c55e":r.result[j]==="present"?"#eab308":"#333",
                display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900
              }}>{c}</div>
            ))}
          </div>
        ))}
        {status==="playing"&&(
          <div style={{display:"flex",justifyContent:"center",gap:4}}>
            {current.map((c,i)=>(
              <div key={i} style={{width:32,height:40,background:"#222",display:"flex",alignItems:"center",justifyContent:"center"}}>{c}</div>
            ))}
          </div>
        )}
      </div>

      {/* KEYBOARD */}
      {keyboardLayout.map((row,i)=>(
        <div key={i} style={{display:"flex",gap:6,marginTop:8}}>
          {row.map(k=>(
            <button className="key" key={k} onClick={()=>handle(k)} style={{
              flex:k==="ENTER"||k==="⌫"?2:1,
              padding:12,
              borderRadius:8,
              background:keyboard[k]==="correct"?"#22c55e":keyboard[k]==="present"?"#eab308":keyboard[k]==="absent"?"#333":"#555",
              color:"#fff",
              fontWeight:900
            }}>{k}</button>
          ))}
        </div>
      ))}

      {status!=="playing"&&<h2 style={{textAlign:"center"}}>{status==="won"?"🎉 "+target:"❌ "+target}</h2>}
    </div>
  )
}
