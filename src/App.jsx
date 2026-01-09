import { useEffect, useRef, useState } from "react"

const grid = 6
const revealOrder = [
  // centro
  14, 15, 20, 21,

  // anel 1
  8, 9, 13, 16, 19, 22, 26, 27,

  // anel 2
  7, 10, 17, 23, 28, 25, 18, 11,

  // bordas
  2, 3, 4, 5,
  30, 31, 32, 33,
  6, 12, 24, 29,
  0, 1, 34, 35
]


const painting = {
  artist: "Vincent van Gogh",
  image: "/artworks/van-gogh_starry-night.jpg"
}

export default function App() {
  const canvasRef = useRef(null)
  const [revealed, setRevealed] = useState(1)
  const [guess, setGuess] = useState("")
  const [status, setStatus] = useState("playing") // playing | won | lost

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    const img = new Image()
    img.src = painting.image

    img.onload = () => {
      const side = Math.min(img.width, img.height)

// pega um quadrado central da imagem
const offsetX = (img.width - side) / 2
const offsetY = (img.height - side) / 2

const tile = side / grid

      const size = 360

      canvas.width = size
      canvas.height = size
      ctx.clearRect(0, 0, size, size)

      for (let i = 0; i < revealed; i++) {
        const index = revealOrder[i]
        const col = index % grid
        const row = Math.floor(index / grid)

        ctx.drawImage(
  img,
  offsetX + col * tile,
  offsetY + row * tile,
  tile,
  tile,
  col * (size / grid),
  row * (size / grid),
  size / grid,
  size / grid
)

      }
    }
  }, [revealed])

  function submitGuess() {
    if (guess.toLowerCase().includes("van gogh")) {
      setStatus("won")
      setRevealed(36)
    } else {
      if (revealed >= revealOrder.length - 1) {
        setStatus("lost")
        setRevealed(36)
      } else {
        setRevealed(r => r + 1)
      }
    }
  }

  return (
    <div style={{ padding: 20, maxWidth: 400 }}>
      <h1>Guess the Artist</h1>

      <canvas ref={canvasRef} style={{ border: "2px solid black" }} />

      {status === "playing" && (
        <>
          <input
            value={guess}
            onChange={e => setGuess(e.target.value)}
            placeholder="Type the artist..."
            style={{ width: "100%", marginTop: 10 }}
          />
          <button onClick={submitGuess} style={{ width: "100%", marginTop: 10 }}>
            Guess
          </button>
        </>
      )}

      {status === "won" && <h2>🎉 Correct!</h2>}
      {status === "lost" && <h2>❌ The artist was Vincent van Gogh</h2>}
    </div>
  )
}
