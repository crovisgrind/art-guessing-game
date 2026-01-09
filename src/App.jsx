import { useEffect, useMemo, useRef, useState } from "react"
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
  const start = new Date(2024,0,1)
  const today = new Date()
  const diff = Math.floor((today - start) / (1000*60*60*24))
  return paintings[diff % paintings.length]
}

export default function App(){
  const painting = getDailyPainting()
  const target = painting.artist
  const normTarget = normalize(target)
  const storageKey = "art-guess-"+painting.id

  const pattern = useMemo(
    ()=>target.split("").map(c => (isLetter(normalize(c)) ? null : c)),
    [target]
  )
  const slots = pattern.filter(c=>c===null).length

  const [rows,setRows] = useState([])
  const [current,setCurrent] = useState(pattern.map(c=>c||""))
  const [keyboard,setKeyboard] = useState({})
  const [status,setStatus] = useState("playing")

  const [pool,setPool] = useState([])
  const [revealed,setRevealed] = useState([])
  const [anim,setAnim] = useState(false)

  const canvasRef = useRef()

  // init
  useEffect(()=>{
    const tiles=[...Array(TILES).keys()].sort(()=>Math.random()-0.5)
    setPool(tiles)
    setRevealed([tiles[0]])

    const base = pattern.map(c => (c!==null ? c : ""))
    setCurrent(base)

    const saved = localStorage.getItem(storageKey)
    if(saved==="won") setStatus("won")
    if(saved==="lost") setStatus("lost")
  },[])

  // draw canvas
  useEffect(()=>{
    const img = new Image()
    img.src = painting.image
    img.onload = ()=>{
      const c = canvasRef.current
      const ctx = c.getContext("2d")
      const size = 360
      c.width = size
      c.height = size
      ctx.clearRect(0,0,size,size)

      const side = Math.min(img.width,img.height)
      const ox = (img.width - side)/2
      const oy = (img.height - side)/2
      const t = side / GRID
      const d = size / GRID

      revealed.forEach(i=>{
        const col = i % GRID
        const row = Math.floor(i / GRID)
        ctx.drawImage(img, ox + col*t, oy + row*t, t, t, col*d, row*d, d, d)
      })
    }
  },[revealed,painting])

  const revealOne = ()=>{
    setAnim(true)
    setTimeout(()=>setAnim(false),300)
    setRevealed(r => (r.length < pool.length ? [...r, pool[r.length]] : r))
  }

  // typing
  const nextEmptyIndex = ()=>{
    for(let i=0;i<current.length;i++){
      if(pattern[i]===null && !current[i]) return i
    }
    return -1
  }

  const prevFilledIndex = ()=>{
    for(let i=current.length-1;i>=0;i--){
      if(pattern[i]===null && current[i]) return i
    }
    return -1
  }

  const type = l=>{
    if(status!=="playing") return
    const i = nextEmptyIndex()
    if(i!==-1){
      const n=[...current]; n[i]=l; setCurrent(n)
    }
  }

  const backspace = ()=>{
    if(status!=="playing") return
    const i = prevFilledIndex()
    if(i!==-1){
      const n=[...current]; n[i]=""; setCurrent(n)
    }
  }

  const submit = ()=>{
    if(status!=="playing") return
    const letters = current.filter((c,i)=>pattern[i]===null).join("")
    if(letters.length!==slots) return

    const g = normalize(letters)
    const t = normTarget.split("")
    const a = g.split("")

    const res = Array(slots).fill("absent")
    const cnt = {}

    t.forEach((c,i)=>{
      if(a[i]===c) res[i]="correct"
      else cnt[c]=(cnt[c]||0)+1
    })
    a.forEach((c,i)=>{
      if(res[i]==="correct") return
      if(cnt[c]){
        res[i]="present"; cnt[c]--
      }
    })

    let k=0
    const full = pattern.map(p => p!==null ? "skip" : res[k++])

    setRows(r=>[...r,{letters:[...current], result:full}])

    const kb={...keyboard}
    a.forEach((c,i)=>{ if(kb[c]!=="correct") kb[c]=res[i] })
    setKeyboard(kb)

    if(g===normTarget){
      if(navigator.vibrate) navigator.vibrate([40,40,80])
      setStatus("won")
      setRevealed(pool)
      localStorage.setItem(storageKey,"won")
      return
    }

    revealOne()
    if(navigator.vibrate) navigator.vibrate(20)

    if(rows.length+1>=MAX_GUESSES){
      setStatus("lost")
      setRevealed(pool)
      localStorage.setItem(storageKey,"lost")
    }

    setCurrent(pattern.map(c=>c||""))
  }

  const handleKey = k=>{
    if(k==="ENTER") submit()
    else if(k==="⌫") backspace()
    else if(isLetter(k)) type(k)
  }

  // share
  const share = ()=>{
    const rowsEmojis = rows.map(r =>
      r.result.filter(x=>x!=="skip").map(x=>x==="correct"?"🟩":x==="present"?"🟨":"⬛").join("")
    ).join("\n")
    const text = `🎨 ART GUESS\n\n${rowsEmojis}\n\n${location.href}`
    navigator.clipboard.writeText(text)
    alert("Copied!")
  }

  const cellStyle = r=>({
    width:"clamp(32px,9vw,36px)",
    height:"clamp(38px,11vw,44px)",
    display:"flex",
    alignItems:"center",
    justifyContent:"center",
    fontWeight:900,
    fontSize:"clamp(16px,4.5vw,20px)",
    borderRadius:6,
    background:
      r==="correct"?"#22c55e":
      r==="present"?"#eab308":
      r==="absent"?"#333":"#222"
  })

  return(
    <div style={{minHeight:"100dvh",background:"linear-gradient(135deg,#0f0f0f,#2a0f1f)",color:"#fff",padding:"env(safe-area-inset-top) 12px 12px"}}>
      <style>{`.key:active{transform:scale(.94)}`}</style>

      <div style={{maxWidth:420,margin:"0 auto",background:"#111",borderRadius:24,padding:16}}>
        <h1 style={{textAlign:"center"}}>🎨 Art Guess</h1>

        <canvas
          ref={canvasRef}
          style={{
            width:"100%",
            maxWidth:360,
            aspectRatio:"1/1",
            borderRadius:16,
            border:"2px solid #333",
            margin:"12px auto",
            display:"block",
            transition:"transform .3s, opacity .3s",
            transform:anim?"scale(1.05)":"scale(1)",
            opacity:anim?0.8:1
          }}
        />

        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {rows.map((r,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"center",gap:4}}>
              {r.letters.map((c,j)=>(
                <div key={j} style={cellStyle(r.result[j])}>{c}</div>
              ))}
            </div>
          ))}
          {status==="playing" && rows.length<MAX_GUESSES && (
            <div style={{display:"flex",justifyContent:"center",gap:4}}>
              {current.map((c,i)=>(
                <div key={i} style={cellStyle("")}>{c}</div>
              ))}
            </div>
          )}
        </div>

        {keyboardLayout.map((row,i)=>(
          <div key={i} style={{display:"flex",gap:6,marginTop:8}}>
            {row.map(k=>{
              const s=keyboard[k]
              return(
                <button className="key" key={k} onClick={()=>handleKey(k)}
                  style={{
                    flex:k==="ENTER"||k==="⌫"?2:1,
                    padding:"clamp(10px,2.5vw,14px)",
                    borderRadius:8,
                    fontWeight:900,
                    fontSize:"clamp(12px,3vw,16px)",
                    background:s==="correct"?"#22c55e":s==="present"?"#eab308":s==="absent"?"#333":"#666",
                    color:"#fff"
                  }}>{k}</button>
              )
            })}
          </div>
        ))}

        {status!=="playing"&&(
          <div style={{textAlign:"center",marginTop:12}}>
            <h2>{status==="won"?"🎉 "+target:"❌ "+target}</h2>
            <button onClick={share} style={{marginTop:10,padding:12,background:"#fff",color:"#000",borderRadius:10,fontWeight:900}}>Share</button>
          </div>
        )}
      </div>
    </div>
  )
}
