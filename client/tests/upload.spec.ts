import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test('新規PJ作成後にExcelをアップロードできる', async ({ page }, testInfo) => {
  // 前提: ルートで `npm run dev` を起動済み（client:5173, server:5001）
  await page.goto('/projects');

  // 新規プロジェクト作成
  await page.getByRole('button', { name: '新規プロジェクト作成' }).click();
  const pjName = `E2E-${Date.now()}`;
  await page.getByPlaceholder('プロジェクト名を入力').fill(pjName);
  await page.getByRole('button', { name: '作成' }).click();

  // プロジェクトカードが表示されるまで待機して遷移
  const card = page.getByRole('heading', { name: pjName });
  await expect(card).toBeVisible();
  await card.click();

  // ScheduleページでアップロードUIが見えること
  await expect(page.getByText('Excel 取り込み（アップロード）')).toBeVisible();

  // サンプルファイルのパス
  const samplePath = path.resolve(process.cwd(), '../sample.xlsx');
  if (!fs.existsSync(samplePath)) throw new Error(`sample.xlsx not found at ${samplePath}`);

  // Networkレスポンスを待ち構える
  const waitUpload = page.waitForResponse((res) =>
    res.url().includes('/api/upload/excel') && res.request().method() === 'POST'
  );

  // ファイル選択→アップロード
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(samplePath);
  await page.getByRole('button', { name: 'アップロード' }).click();

  const res = await waitUpload;
  const json = await res.json();
  // 証跡保存
  const artifactsDir = path.resolve(process.cwd(), 'test-artifacts');
  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(path.join(artifactsDir, `upload-response-${Date.now()}.json`), JSON.stringify(json, null, 2));

  // 画面表示確認
  await expect(page.getByText('保存名:')).toBeVisible();
  await expect(page.getByText('元ファイル:')).toBeVisible();

  // スクリーンショット
  await page.screenshot({ path: path.join(artifactsDir, 'upload-ui.png'), fullPage: true });
});

