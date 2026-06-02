> task-id: simplify-ecc-lifecycle
> created: 2026-06-02

## 问题
ECC 生命周期太重（7阶段+每阶段人工签字），需求和架构串行导致变更成本高。ECC 的 planner/architect/tdd-guide 本身能处理规划到审查，但 PMCP 在前面加了 3 道重复的门。

## 方向
3 阶段轻量流程：Understand（问题探索）-> Execute（ECC 全量接管）-> Close（总结归档）。PMCP 只管前后，中间交给 ECC。

## 约束
- 不改 src/ 核心代码
- 不破坏 hooks/adapters 架构
- 不破坏对话级日志系统
