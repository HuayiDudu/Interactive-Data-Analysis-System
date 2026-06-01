"""
value_objects.py - 值对象定义
==================================
【层】核心架构抽象（贯穿各层的通用组件）
【说明】定义不可变的值对象，在各层间显式传递数据集标识，消除隐式状态依赖。
【负责人】项目负责人（通用组件）
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class DatasetRef:
    """
    数据集引用（不可变值对象）。

    唯一标识一个已保存的数据集，由数据访问层生成，上层透传。
    控制层从前端请求中接收 dataset_id 字符串，构造此对象后传入 Service 层。

    MVP 阶段:
        id 为内部映射的 UUID 十六进制字符串（由 FileRepository 生成）
    扩展阶段:
        id 为数据库自增主键的字符串形式（由 SQLiteRepository 生成）
    """
    id: str
