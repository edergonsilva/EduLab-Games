import { useState } from 'react'
import type { Game } from '../api/games'
import { gameBannerUrl } from '../api/games'
import { cx } from './ui'

export function GameBanner({ game, className }: { game: Game; className?: string }) {
  const [failed, setFailed] = useState(false)
  const source = gameBannerUrl(game)

  return (
    <div className={cx('aspect-[16/7] w-full overflow-hidden bg-canvas', className)}>
      {source && !failed ? (
        <img
          src={source}
          alt={`Capa do jogo ${game.title}`}
          className="size-full object-cover"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="grid size-full place-items-center text-sm font-medium text-muted">
          Capa indisponível
        </div>
      )}
    </div>
  )
}