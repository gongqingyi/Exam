# Mathstalents 小学版试卷精编

本目录是独立的临时 LaTeX 工程，与上级项目代码无关。包含第三至第六套卷的：

- 完整题目；
- 参考答案、思路分析、详细步骤、方法总结；
- 用 TikZ/PGFPlots 重新绘制的题目插图；
- 统一设计的 A4 彩色排版与可打印 PDF。

## 成品

- `Mathstalents小学版-第三套卷-精编版.pdf`
- `Mathstalents小学版-第四套卷-精编版.pdf`
- `Mathstalents小学版-第五套卷-精编版.pdf`
- `Mathstalents小学版-第六套卷-精编版.pdf`

## 重新编译

需要 TeX Live 及 XeLaTeX：

```bash
bash build.sh
```

工程使用 TeX Live 自带的 TeX Gyre 与 Fandol 字体，避免依赖本机字体名称。

## 目录

- `shared/style.tex`：各套卷共用的配色、边框、题目框、解析框及封面样式；
- `paper3/`、`paper4/`、`paper5/`、`paper6/`：每套卷的主文件、题目和答案；
- `source/`：从公开文章提取的原始网页资料和图片清单；
- `paper*/assets/original/`：仅供校对的原始参考图及 OCR 中间结果，不被成品 PDF 引用；
- `tools/`：网页图片提取、OCR、内容校验及 PDF 渲染脚本；
- `build/`：逐页视觉检查用的临时渲染图。

## 原始资料

- 第六套卷：<https://mp.weixin.qq.com/s/FiQo4ZVuFHm5Kax0akR1_g>
- 第五套卷：<https://mp.weixin.qq.com/s/z6791yxUmoyf3FFRUBLyvQ>
- 第四套卷：<https://mp.weixin.qq.com/s/LCRwD26YWkFctqIW7DR_OA>
- 第三套卷：<https://mp.weixin.qq.com/s/ZgvbqFhEMxDeCAzKUoPY0g>

原题资料中的水印、公众号标识和网页装饰不属于题目图形，未在成品中复刻。
