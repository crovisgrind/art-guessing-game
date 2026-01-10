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

// ---------- utils ----------
const normalize = t =>
  t.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Z]/gi,"").toUpperCase()

const isLetter = c => /^[A-Z]$/.test(c)

function getDailyPainting(){
  const start = new Date(2024,0,1)
  const today = new Date()
  const diff = Math.floor((today - start) / (1000*60*60*24))
  return paintings[diff % paintings.length]
}

// ---------- app ----------
export default function App(){
  const painting = getDailyPainting()
  const target = painting.artist
  const normTarget = normalize(target)
  const storageKey = "art-guess-"+painting.id

  const pattern = useMemo(() =>
    target.split("").map(c => (isLetter(normalize(c)) ? null : c)), [target]
  )

  const slots = pattern.filter(c => c===null).length

  const [rows,setRows] = useState([])
  const [current,setCurrent] = useState(Array(pattern.length).fill(""))
  const [keyboard,setKeyboard] = useState({})
  const [status,setStatus] = useState("playing")

  const [pool,setPool] = useState([])
  const [revealed,setRevealed] = useState([])
  const canvasRef = useRef()

  // ---------- init with anti-cheat ----------
  useEffect(()=>{
    let data = localStorage.getItem(storageKey)
    if(data){
      data = JSON.parse(data)
    } else {
      data = {
        tiles: [...Array(TILES).keys()].sort(()=>Math.random()-0.5),
        revealedCount: 1,
        status: "playing"
      }
      localStorage.setItem(storageKey, JSON.stringify(data))
    }

    setPool(data.tiles)
    setRevealed(data.tiles.slice(0,data.revealedCount))
    setStatus(data.status)

    const base = pattern.map(c => (c!==null ? c : ""))
    setCurrent(base)
  },[])

  // ---------- canvas ----------
  useEffect(()=>{
    const img=new Image()
    img.src=painting.image
    img.onload=()=>{
      const c=canvasRef.current
      const ctx=c.getContext("2d")
      const size=360
      c.width=size; c.height=size
      ctx.clearRect(0,0,size,size)

      const side=Math.min(img.width,img.height)
      const ox=(img.width-side)/2
      const oy=(img.height-side)/2
      const t=side/GRID
      const d=size/GRID

      revealed.forEach(i=>{
        const col=i%GRID,row=Math.floor(i/GRID)
        ctx.drawImage(img,ox+col*t,oy+row*t,t,t,col*d,row*d,d,d)
      })
    }
  },[revealed,painting])

  const revealOne = ()=>{
    setRevealed(r=>{
      if(r.length>=pool.length) return r
      const newCount = r.length + 1
      const newTiles = pool.slice(0,newCount)

      const saved = JSON.parse(localStorage.getItem(storageKey))
      localStorage.setItem(storageKey, JSON.stringify({
        ...saved,
        revealedCount:newCount
      }))

      return newTiles
    })
  }

  // ---------- typing ----------
  const nextEmptyIndex = arr=>{
    for(let i=0;i<arr.length;i++){
      if(pattern[i]===null && !arr[i]) return i
    }
    return -1
  }

  const prevFilledIndex = arr=>{
    for(let i=arr.length-1;i>=0;i--){
      if(pattern[i]===null && arr[i]) return i
    }
    return -1
  }

  const typeLetter = l=>{
    if(status!=="playing") return
    const i = nextEmptyIndex(current)
    if(i!==-1){
      const n=[...current]; n[i]=l; setCurrent(n)
    }
  }

  const backspace = ()=>{
    if(status!=="playing") return
    const i = prevFilledIndex(current)
    if(i!==-1){
      const n=[...current]; n[i]=""; setCurrent(n)
    }
  }

  const submit = ()=>{
    if(status!=="playing") return
    const letters = current.filter((c,i)=>pattern[i]===null).join("")
    if(letters.length!==slots) return

    const guessNorm = normalize(letters)
    const targetArr = normTarget.split("")
    const guessArr = guessNorm.split("")

    const res = Array(slots).fill("absent")
    const counts={}

    targetArr.forEach((c,i)=>{
      if(guessArr[i]===c) res[i]="correct"
      else counts[c]=(counts[c]||0)+1
    })

    guessArr.forEach((c,i)=>{
      if(res[i]==="correct") return
      if(counts[c]){
        res[i]="present"; counts[c]--
      }
    })

    let k=0
    const fullRes = pattern.map(p => p!==null ? "skip" : res[k++])

    setRows(r=>[...r,{letters:[...current], result:fullRes}])

    const kb={...keyboard}
    guessArr.forEach((c,i)=>{
      if(kb[c]!=="correct") kb[c]=res[i]
    })
    setKeyboard(kb)

    if(guessNorm===normTarget){
      if(navigator.vibrate) navigator.vibrate(200)

      setRevealed(pool)
      setStatus("won")

      const saved = JSON.parse(localStorage.getItem(storageKey))
      localStorage.setItem(storageKey, JSON.stringify({
        ...saved,
        status:"won",
        revealedCount: pool.length
      }))
      return
    }

    revealOne()

    if(rows.length+1>=MAX_GUESSES){
      setStatus("lost")
      setRevealed(pool)

      const saved = JSON.parse(localStorage.getItem(storageKey))
      localStorage.setItem(storageKey, JSON.stringify({
        ...saved,
        status:"lost",
        revealedCount: pool.length
      }))
    }

    const base = pattern.map(c => (c!==null ? c : ""))
    setCurrent(base)
  }

  const handleKey = k=>{
    if(navigator.vibrate) navigator.vibrate(10)
    if(k==="ENTER") submit()
    else if(k==="⌫") backspace()
    else if(isLetter(k)) typeLetter(k)
  }

  const share = ()=>{
    if(navigator.vibrate) navigator.vibrate([50,30,50])
    const rowsEmojis = rows.map(r =>
      r.result.filter(x=>x!=="skip").map(x=>x==="correct"?"🟩":x==="present"?"🟨":"⬛").join("")
    ).join("\n")
    const text = `🎨 ART GUESS\n\n${rowsEmojis}\n\n${location.href}`
    
    if(navigator.share){
      navigator.share({text}).catch(()=>{})
    } else {
      navigator.clipboard.writeText(text)
      alert("Copied!")
    }
  }

  const cellStyle = r=>({
    width:"clamp(28px,8vw,36px)",
    height:"clamp(36px,10vw,44px)",
    display:"flex",
    alignItems:"center",
    justifyContent:"center",
    fontWeight:900,
    fontSize:"clamp(14px,4vw,20px)",
    borderRadius:6,
    background:
      r==="correct"?"#22c55e":
      r==="present"?"#eab308":
      r==="absent"?"#333":"#222",
    transition:"background 0.3s ease"
  })

  return(
    <div style={{
      minHeight:"100dvh",
      background:"linear-gradient(135deg,#0f0f0f,#2a0f1f)",
      color:"#fff",
      padding:"8px",
      boxSizing:"border-box",
      overflowX:"hidden",
      display:"flex",
      alignItems:"center",
      justifyContent:"center"
    }}>
      <div style={{
        width:"100%",
        maxWidth:420,
        background:"#111",
        borderRadius:16,
        padding:"12px",
        boxSizing:"border-box"
      }}>
        <h1 style={{
          textAlign:"center",
          fontSize:"clamp(20px,5vw,28px)",
          margin:"8px 0 12px 0"
        }}>🎨 Art Guess</h1>

        <canvas
          ref={canvasRef}
          style={{
            width:"100%",
            maxWidth:360,
            aspectRatio:"1 / 1",
            borderRadius:12,
            border:"2px solid #333",
            margin:"0 auto 12px auto",
            display:"block",
            boxSizing:"border-box",
            touchAction:"none"
          }}
        />

        <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:8}}>
          {rows.map((row,i)=>(
            <div key={i} style={{display:"flex",gap:3,justifyContent:"center",flexWrap:"wrap"}}>
              {row.letters.map((c,j)=>(<div key={j} style={cellStyle(row.result[j])}>{c}</div>))}
            </div>
          ))}
          {status==="playing" && rows.length<MAX_GUESSES && (
            <div style={{display:"flex",gap:3,justifyContent:"center",flexWrap:"wrap"}}>
              {current.map((c,i)=>(<div key={i} style={cellStyle("")}>{c}</div>))}
            </div>
          )}
        </div>

        <div style={{maxWidth:360,margin:"0 auto"}}>
          {keyboardLayout.map((row,i)=>(
            <div key={i} style={{
              display:"flex",
              gap:4,
              marginTop:6,
              justifyContent:"center"
            }}>
              {row.map(k=>{
                const s=keyboard[k]
                return(
                  <button key={k} onClick={()=>handleKey(k)} style={{
                    flex:k==="ENTER"||k==="⌫"?1.5:1,
                    minWidth:k==="ENTER"||k==="⌫"?"50px":"28px",
                    padding:"12px 4px",
                    borderRadius:6,
                    fontWeight:900,
                    fontSize:"clamp(11px,2.8vw,14px)",
                    background:s==="correct"?"#22c55e":s==="present"?"#eab308":s==="absent"?"#333":"#666",
                    color:"#fff",
                    border:"none",
                    cursor:"pointer",
                    touchAction:"manipulation",
                    WebkitTapHighlightColor:"transparent",
                    transition:"opacity 0.15s ease",
                    opacity:1
                  }}
                  onTouchStart={e=>e.currentTarget.style.opacity=0.7}
                  onTouchEnd={e=>e.currentTarget.style.opacity=1}
                  >{k}</button>
                )
              })}
            </div>
          ))}
        </div>

        {status!=="playing"&&(
          <div style={{textAlign:"center",marginTop:16}}>
            <h2 style={{
              fontSize:"clamp(18px,4.5vw,24px)",
              margin:"8px 0"
            }}>{status==="won"?"🎉 Correct!":"❌ "+target}</h2>
            <button onClick={share} style={{
              marginTop:12,
              padding:"14px 28px",
              background:"#fff",
              color:"#000",
              borderRadius:10,
              fontWeight:900,
              fontSize:"clamp(14px,3.5vw,16px)",
              border:"none",
              cursor:"pointer",
              touchAction:"manipulation",
              WebkitTapHighlightColor:"transparent"
            }}>Share</button>
          </div>
        )}
      </div>
    </div>
  )
}