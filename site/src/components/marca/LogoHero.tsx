/**
 * Logo completa para a página inicial: o contorno do Brasil se desenha,
 * as barras sobem e o nome aparece. Toca uma vez, ao montar.
 * Quem pede menos movimento no sistema vê a logo parada e completa.
 */
import "./logo-hero.css";

export function LogoHero({ className = "" }: { className?: string }) {
  return (
    <div className={`mbh flex flex-col items-center ${className}`}>
      <svg
        viewBox="0 0 660 590"
        className="w-full max-w-[280px] h-auto"
        role="img"
        aria-label="Mercado Brasil"
      >
        <defs>
          <linearGradient id="mbh-tr" gradientUnits="userSpaceOnUse" x1="20" y1="0" x2="640" y2="0">
            <stop offset="0" stopColor="#0A8A43" />
            <stop offset=".45" stopColor="#3CB241" />
            <stop offset=".66" stopColor="#88BE2E" />
            <stop offset=".86" style={{ stopColor: "var(--mb-mapa-fim)" }} />
          </linearGradient>
          <linearGradient id="mbh-b0" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0062A0" />
            <stop offset="1" stopColor="#014B89" />
          </linearGradient>
          <linearGradient id="mbh-b1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2B9B3B" />
            <stop offset="1" stopColor="#05763B" />
          </linearGradient>
          <linearGradient id="mbh-b2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#A2BC1F" />
            <stop offset="1" stopColor="#619B22" />
          </linearGradient>
          <linearGradient id="mbh-b3" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "var(--mb-amarelo-marca)" }} />
            <stop offset="1" style={{ stopColor: "var(--mb-amarelo-marca-base)" }} />
          </linearGradient>
        </defs>
        <path
          className="mbh-mapa"
          pathLength={1}
          d="M253.8 381.5 C252.2 377.5 246.5 362.4 244.2 357.0 C241.9 351.7 241.5 351.7 239.9 349.2 C238.3 346.8 237.1 344.8 234.7 342.3 C232.3 339.7 230.7 337.8 225.6 334.0 C220.5 330.3 209.0 323.3 204.1 319.9 C199.1 316.5 198.5 315.9 195.8 313.4 C193.0 310.9 192.0 310.0 187.8 304.9 C183.5 299.9 174.7 288.1 170.0 282.9 C165.3 277.7 163.4 276.3 159.6 273.9 C155.8 271.4 151.6 269.6 147.2 268.3 C142.8 267.0 137.6 266.4 133.3 266.2 C129.1 266.0 127.5 266.1 121.7 266.9 C115.9 267.7 103.9 270.5 98.5 271.2 C93.1 271.9 92.3 271.7 89.3 271.3 C86.3 270.9 83.6 270.1 80.7 268.7 C77.8 267.3 78.1 267.7 71.8 262.6 C65.5 257.6 49.2 244.2 42.9 238.4 C36.5 232.6 35.6 230.6 33.6 227.8 C31.7 225.0 31.6 223.9 31.0 221.8 C30.4 219.7 30.0 217.5 30.0 215.0 C30.0 212.5 30.3 209.5 31.0 206.8 C31.6 204.2 32.5 201.5 33.7 199.1 C35.0 196.7 36.5 194.3 38.5 192.1 C40.4 190.0 42.8 188.1 45.3 186.5 C47.8 184.8 46.9 185.0 53.4 182.2 C59.9 179.4 77.6 172.6 84.3 169.4 C91.1 166.3 91.3 165.2 93.9 163.1 C96.5 161.0 98.5 158.9 100.1 156.7 C101.8 154.6 103.0 152.3 103.9 150.0 C104.7 147.7 105.3 149.5 105.4 143.2 C105.5 136.9 104.4 119.7 104.6 112.2 C104.9 104.7 106.0 101.7 106.8 98.1 C107.7 94.5 108.6 93.1 109.7 90.9 C110.8 88.6 112.2 86.5 113.6 84.7 C115.1 82.8 116.9 81.2 118.6 79.9 C120.2 78.7 121.9 77.9 123.7 77.2 C125.5 76.6 127.2 76.2 129.4 76.2 C131.5 76.1 129.6 75.0 136.6 76.8 C143.6 78.5 164.2 84.9 171.2 86.6 C178.2 88.3 176.3 87.0 178.5 86.9 C180.7 86.8 182.3 86.6 184.3 86.0 C186.3 85.3 188.8 84.1 190.5 82.8 C192.2 81.4 193.6 79.7 194.6 77.9 C195.7 76.0 196.0 75.6 196.8 71.8 C197.7 68.0 198.8 58.3 199.6 55.0 C200.3 51.6 200.5 52.7 201.1 51.8 C201.8 50.9 202.1 50.3 203.5 49.7 C204.9 49.0 204.6 48.6 209.3 47.9 C214.0 47.3 223.1 47.4 231.8 45.7 C240.4 44.0 255.0 39.3 261.4 37.7 C267.8 36.1 267.7 36.2 270.3 36.1 C272.9 35.9 275.3 36.1 277.1 36.7 C279.0 37.3 280.2 38.3 281.5 39.8 C282.8 41.3 283.0 41.3 284.8 45.9 C286.7 50.6 290.2 62.1 292.4 67.5 C294.6 72.8 295.8 74.9 298.1 78.1 C300.3 81.2 303.9 84.7 305.9 86.5 C307.9 88.3 308.7 88.3 310.2 88.9 C311.7 89.6 312.5 90.1 315.0 90.2 C317.4 90.4 321.2 90.4 324.7 89.8 C328.3 89.1 326.8 90.5 336.2 86.4 C345.7 82.2 370.7 69.8 381.5 65.0 C392.3 60.1 395.8 58.7 400.8 57.1 C405.8 55.4 408.4 55.2 411.5 55.1 C414.6 55.0 417.0 55.6 419.6 56.5 C422.1 57.5 424.5 58.9 426.6 60.6 C428.7 62.2 430.6 64.2 432.4 66.5 C434.2 68.8 434.7 69.4 437.4 74.4 C440.2 79.5 446.2 92.0 448.9 96.7 C451.5 101.3 451.7 100.7 453.4 102.5 C455.0 104.2 455.6 105.2 458.9 107.2 C462.1 109.2 464.3 111.2 473.1 114.5 C481.9 117.7 500.1 122.8 511.5 126.7 C523.0 130.6 531.1 133.7 541.7 138.0 C552.3 142.2 566.6 148.4 575.0 152.3 C583.5 156.1 587.4 158.2 592.4 161.1 C597.4 164.0 601.4 166.8 605.0 169.8 C608.6 172.8 611.4 175.7 614.2 179.4 C616.9 183.0 619.6 187.3 621.5 191.7 C623.5 196.0 625.1 201.5 626.1 205.3 C627.0 209.2 627.2 211.6 627.4 214.8 C627.6 217.9 627.5 221.1 627.2 224.2 C626.9 227.4 626.5 230.3 625.7 233.6 C624.9 236.8 624.4 239.3 622.6 243.6 C620.8 247.8 619.5 251.4 614.8 259.1 C610.0 266.8 598.5 282.0 593.9 289.8 C589.3 297.7 588.8 300.6 587.1 306.2 C585.4 311.9 585.0 313.7 583.7 323.8 C582.5 333.9 580.6 357.9 579.5 366.9 C578.4 376.0 578.0 374.6 577.1 378.1 C576.1 381.6 575.2 384.5 573.8 388.0 C572.3 391.4 570.3 395.6 568.2 398.9 C566.2 402.2 563.6 405.4 561.3 407.8 C559.1 410.3 558.5 410.9 554.9 413.7 C551.3 416.5 543.3 421.7 539.7 424.7 C536.1 427.7 535.3 428.7 533.5 431.5 C531.8 434.4 531.0 435.1 529.2 441.7 C527.3 448.3 524.0 465.1 522.3 471.2 C520.6 477.2 520.4 475.9 519.0 478.0 C517.6 480.1 514.8 483.0 513.9 483.9"
          fill="none"
          stroke="url(#mbh-tr)"
          strokeWidth={16}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect className="mbh-barra" x="223" y="429" width="52" height="143" rx="5" fill="url(#mbh-b0)" />
        <rect className="mbh-barra" x="303" y="371" width="52" height="201" rx="5" fill="url(#mbh-b1)" />
        <rect className="mbh-barra" x="383" y="300" width="53" height="272" rx="5" fill="url(#mbh-b2)" />
        <rect className="mbh-barra" x="463" y="224" width="52" height="348" rx="5" fill="url(#mbh-b3)" />
      </svg>

      <div className="mbh-nome mt-6 text-center leading-none" aria-hidden="true">
        <div className="text-2xl font-light uppercase tracking-[0.35em] text-foreground">Mercado</div>
        <div className="mt-2 text-5xl font-bold uppercase tracking-[0.22em] text-[var(--mb-verde-claro)]">
          Brasil
        </div>
      </div>

      <div className="mt-5 flex gap-2" aria-hidden="true">
        <span className="mbh-traco h-1 w-12 rounded-full bg-[var(--mb-azul)]" />
        <span className="mbh-traco h-1 w-12 rounded-full bg-[var(--mb-verde)]" />
        <span className="mbh-traco h-1 w-12 rounded-full bg-[var(--mb-amarelo)]" />
      </div>
    </div>
  );
}
