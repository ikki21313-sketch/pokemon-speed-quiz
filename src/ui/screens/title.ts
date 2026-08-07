export function renderTitle(root: HTMLElement, onStart: () => void): void {
  root.innerHTML = `
    <div class="screen screen-title">
      <h1 class="game-title">すばやさクイズ</h1>
      <div class="card rules-card">
        <p>お手本のポケモンより<br>「すばやさ」が高いのはどっち？</p>
        <ul class="rules">
          <li>2匹のうち すばやい ほうを えらぼう</li>
          <li>ぜんぶで 10もん</li>
          <li>こたえると すばやさが ひょうじされるよ</li>
          <li>10もん おわると けっかが みられるよ</li>
        </ul>
        <button class="btn btn-primary" id="start-btn">スタート！</button>
      </div>
      <footer class="credit">
        データ出典: <a href="https://pokeapi.co/" target="_blank" rel="noopener noreferrer">PokéAPI (pokeapi.co)</a> / 非公式ファンプロジェクト
      </footer>
    </div>
  `;
  root.querySelector<HTMLButtonElement>("#start-btn")!.addEventListener("click", onStart);
}
