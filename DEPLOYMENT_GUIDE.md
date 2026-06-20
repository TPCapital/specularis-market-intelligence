# 部署指南 / Deployment Guide

## 问题：你 GitHub 仓库里的代码和这个压缩包不同步

Vercel 是从你的 **GitHub 仓库** 拉代码部署的，不是从压缩包。
你需要把这个压缩包里的文件**替换**掉 GitHub 仓库里的旧文件。

## 方法一：GitHub 网页上传（推荐，最简单）

1. 解压本压缩包，得到 `specularis-rebuilt/` 文件夹
2. 打开 https://github.com/TPCapital/specularis-market-intelligence
3. 逐个上传/替换关键文件：

### 必须替换的文件（最重要）

| 文件 | 操作 | 原因 |
|---|---|---|
| `vercel.json` | 替换 | 明确声明6个函数，解决12函数限制 |
| `api/` 整个文件夹 | 替换 | 旧版有13个文件，新版只有6个 |
| `modules/congress-intel.js` | 新增 | 政要持股自动抓取模块 |
| `modules/specularis-terminal-lite.js` | 替换 | 已更新导入 |
| `styles.css` | 替换 | 修复颜色/比例/字体问题 |

### 上传方法（网页版）

1. 进入 GitHub 仓库页面
2. 点击要替换的文件 → 右上角铅笔图标（Edit）→ 复制粘贴新内容 → Commit
3. 或者拖拽新文件到仓库页面

## 方法二：Git 命令行（如果你用命令行）

```bash
# 克隆你的仓库
git clone https://github.com/TPCapital/specularis-market-intelligence.git
cd specularis-market-intelligence

# 删除旧 api/ 目录，复制新的
rm -rf api/
cp -r /path/to/specularis-rebuilt/api/ .

# 替换其他关键文件
cp /path/to/specularis-rebuilt/vercel.json .
cp /path/to/specularis-rebuilt/styles.css .
cp /path/to/specularis-rebuilt/modules/congress-intel.js modules/
cp /path/to/specularis-rebuilt/modules/specularis-terminal-lite.js modules/

# 提交推送
git add -A
git commit -m "fix: reduce to 6 serverless functions for Vercel Hobby plan"
git push origin main
```

## 验证部署成功

推送后，Vercel 会自动触发新部署。
在 Vercel 控制台确认：
- Build Logs 里显示 "Build Completed"（无错误）
- Functions 数量 = 6（不超过12）

## 最重要的文件：vercel.json

当前内容（确保你的仓库里是这个版本）：

```json
{
  "functions": {
    "api/snapshot.js":              { "maxDuration": 30 },
    "api/daily-report.js":          { "maxDuration": 30 },
    "api/health.js":                { "maxDuration": 10 },
    "api/trade-decision.js":        { "maxDuration": 30 },
    "api/stock-intel-enrichment.js":{ "maxDuration": 30 },
    "api/ai-prompt-generate.js":    { "maxDuration": 30 }
  }
}
```

如果 `api/` 文件夹里还有其他 `.js` 文件（finnhub.js、alphavantage.js、fred.js 等），必须删除它们。
