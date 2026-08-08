export function renderTitle(root: HTMLElement, onStart: () => void): void {
  root.innerHTML = `
    <div class="screen screen-title">
      <h1 class="game-title">すばやさクイズ</h1>
      <div class="card rules-card">
        <p>お手本のポケモンより<br>すばやさ実数値が 高いのは どれ？</p>
        <ul class="rules">
          <li>4匹から お手本より すばやい 1匹を えらぼう</li>
          <li>だれも すばやくないと おもったら「お手本」を タップ！</li>
          <li>それぞれ「振り方」が ちがうよ。無振り=種族値+20、準速=+52、最速=(+52)×1.1(切り捨て)</li>
          <li>ぜんぶで 10もん。こたえると 実数値と 種族値が みられるよ</li>
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
