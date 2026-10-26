'use client'
import './globals.css'
import './ds/tokens.css'
import './ds/cells.css'

// Last resort: the root layout itself failed. It replaces <html>, so it brings its own document and styles.
export default function GlobalError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <html lang="pt-BR">
      <body>
        <main className="ha-status-page">
          <div className="ha-status">
            <h1 className="ha-h2 ha-status__title">A HouseArt não carregou</h1>
            <p className="ha-muted ha-status__text">Tente de novo em instantes.</p>
            <div className="ha-status__actions"><button type="button" className="ha-btn ha-btn--primary ha-btn--md" onClick={() => unstable_retry()}>Tentar de novo</button></div>
            {error.digest ? <p className="ha-caption ha-status__code">Código para o suporte: {error.digest}</p> : null}
          </div>
        </main>
      </body>
    </html>
  )
}
