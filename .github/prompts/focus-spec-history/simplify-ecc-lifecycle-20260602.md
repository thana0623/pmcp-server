> task-id: simplify-ecc-lifecycle
> created: 2026-06-02
> status: confirmed
IN: CLAUDE.md

IN: src/**
IN: .github/prompts/**
IN: adapters/**
IN: .prompts-mcp/**
IN: skills/**

## 问题
ECC 生命周期太重（7阶段+每阶段人工签字），需求和架构串行导致变更成本高。

## 方向
3 阶段轻量流程：Understand -> Execute -> Close。PMCP 只管前后，中间交给 ECC。

## 约束
- 不破坏 hooks/adapters 架构
- 不破坏对话级日志系统
