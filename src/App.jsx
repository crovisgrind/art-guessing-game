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

  // build pattern with spaces/hyphens
  const pattern = useMemo(() =>
    target.split("").map(c => (isLetter(normalize(c)) ? null : c)), [target]
  )

  const slots = pattern.filter(c => c===null).length

  // grid state
  const [rows,setRows] = useState([]) // [{letters:Array, result:Array}]
  const [cursor,setCursor] = useState(0)
  const [current,setCurrent] = useState(Array(pattern.length).fill(""))
  const [keyboard,setKeyboard] = useState({})
  const [status,setStatus] = useState("playing")

  // canvas
  const [pool,setPool] = useState([])
  const [revealed,setRevealed] = useState([])
  const canvasRef = useRef()

  // init
  useEffect(()=>{
    const tiles=[...Array(TILES).keys()].sort(()=>Math.random()-0.5)
    setPool(tiles)
    setRevealed([tiles[0]])

    // prefill spaces/hyphens
    const base = pattern.map(c => (c!==null ? c : ""))
    setCurrent(base)

    const saved = localStorage.getItem(storageKey)
    if(saved==="won") setStatus("won")
    if(saved==="lost") setStatus("lost")
  },[])

  // canvas draw
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

  const revealOne = () =>
    setRevealed(r => (r.length < pool.length ? [...r, pool[r.length]] : r))

  // ---------- typing ----------
  const nextEmptyIndex = (arr,from=0)=>{
    for(let i=from;i<arr.length;i++){
      if(pattern[i]===null && !arr[i]) return i
    }
    return -1
  }

  const prevFilledIndex = (arr,from)=>{
    for(let i=from;i>=0;i--){
      if(pattern[i]===null && arr[i]) return i
    }
    return -1
  }

  const typeLetter = l=>{
    if(status!=="playing") return
    const i = nextEmptyIndex(current,0)
    if(i!==-1){
      const n=[...current]; n[i]=l; setCurrent(n); setCursor(i+1)
    }
  }

  const backspace = ()=>{
    if(status!=="playing") return
    const i = prevFilledIndex(current,current.length-1)
    if(i!==-1){
      const n=[...current]; n[i]=""; setCurrent(n); setCursor(i)
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

    // map back to pattern positions
    let k=0
    const fullRes = pattern.map(p => p!==null ? "skip" : res[k++])

    setRows(r=>[...r,{letters:[...current], result:fullRes}])

    // update keyboard
    const kb={...keyboard}
    guessArr.forEach((c,i)=>{
      if(kb[c]==="correct") return
      kb[c]=res[i]
    })
    setKeyboard(kb)

    if(guessNorm===normTarget){
      setStatus("won")
      setRevealed(pool)
      localStorage.setItem(storageKey,"won")
      return
    }

    revealOne()

    if(rows.length+1>=MAX_GUESSES){
      setStatus("lost")
      setRevealed(pool)
      localStorage.setItem(storageKey,"lost")
    }

    // new row
    const base = pattern.map(c => (c!==null ? c : ""))
    setCurrent(base)
  }

  const handleKey = k=>{
    if(k==="ENTER") submit()
    else if(k==="⌫") backspace()
    else if(isLetter(k)) typeLetter(k)
  }

  // ---------- share ----------
  const share = ()=>{
    const rowsEmojis = rows.map(r =>
      r.result.filter(x=>x!=="skip").map(x=>x==="correct"?"🟩":x==="present"?"🟨":"⬛").join("")
    ).join("\n")
    const text = `🎨 ART GUESS\n\n${rowsEmojis}\n\n${location.href}`
    navigator.clipboard.writeText(text)
    alert("Copied!")
  }

  // ---------- UI ----------
  const cellStyle = (r)=>({
    width:36,height:44,display:"flex",alignItems:"center",justifyContent:"center",
    fontWeight:900,borderRadius:6,
    background:
      r==="correct"?"#22c55e":
      r==="present"?"#eab308":
      r==="absent"?"#333":"#222"
  })

  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#0f0f0f,#2a0f1f)",color:"#fff",padding:20}}>
      <div style={{maxWidth:420,margin:"auto",background:"#111",borderRadius:24,padding:20}}>
        <h1 style={{textAlign:"center",fontSize:32,fontWeight:900}}>🎨 Art Guess</h1>

        <canvas ref={canvasRef} style={{width:"100%",borderRadius:16,border:"2px solid #333",margin:"12px 0"}}/>

        {/* GRID */}
        <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:12}}>
          {rows.map((row,i)=>(
  <div key={i} style={{display:"flex",gap:4,justifyContent:"center"}}>
    {row.letters.map((c,j)=>(
      <div key={j} style={cellStyle(row.result[j])}>{c}</div>
    ))}
  </div>
))}

{status==="playing" && rows.length < MAX_GUESSES && (
  <div style={{display:"flex",gap:4,justifyContent:"center"}}>
    {current.map((c,i)=>(
      <div key={i} style={cellStyle("")}>{c}</div>
    ))}
  </div>
)}

        </div>

        {/* KEYBOARD */}
        {keyboardLayout.map((row,i)=>(
          <div key={i} style={{display:"flex",gap:6,marginBottom:6}}>
            {row.map(k=>{
              const s=keyboard[k]
              return(
                <button key={k} onClick={()=>handleKey(k)}
                  style={{
                    flex:k==="ENTER"||k==="⌫"?2:1,
                    padding:12,
                    borderRadius:8,
                    fontWeight:900,
                    background:s==="correct"?"#22c55e":s==="present"?"#eab308":s==="absent"?"#333":"#666"
                  }}>{k}</button>
              )
            })}
          </div>
        ))}

        {status!=="playing"&&(
          <div style={{textAlign:"center",marginTop:12}}>
            <h2>{status==="won"?"🎉 Correct!":"❌ "+target}</h2>
            <button onClick={share} style={{marginTop:10,padding:12,background:"#fff",color:"#000",borderRadius:10,fontWeight:900}}>Share</button>
          </div>
        )}
      </div>
    </div>
  )
}
