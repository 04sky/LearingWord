---
title: Kafka源码分析系列-目录
date: 2023-06-03 16:45:08
permalink: /high-performance/message-queue/kafka-source-code-research/source-note/
categories:
  - high-performance
  - message-queue
  - kafka-source-code-research
tags:
  - 消息队列
---

# Kafka源码分析系列-目录

> 《Kafka源码分析》系列文章计划按“数据传递”的顺序写作，即：先分析生产者，其次分析Server端的数据处理，然后分析消费者，最后再补充部分事务和流式计算相关内容。

## 一. 概述

介绍Kafka的背景、定位、基本思想及原理以及源码结构等内容。

## 二. 生产者

分析生产者的线程模型、压缩机制等方面内容。

## 三. Server端-消息存储

承接上一篇生产者文章，分析Producer发来的消息在Server端是如何存的。

涉及业务模型、文件结构等方面内容。

## 四. Server端-请求处理框架 (Writing)

分析Server端是处理请求的流程。至此，承接上文，我们不仅知道消息时如何发送和存储，

也知道了在这两步之间请求是如何被处理的。

## 五. Server端-时间轮延时组件 (待写作)

Kafka内部很多业务流程涉及"延时"操作，这里给大家单独分析分析。

## 六. Server端-可靠性保证 (待写作)

通过上面文章，我们已知道生产者->Server端存储的完整流程。接下来分析已存好的消息数据如何不丢。涉及"集群管理"和"副本机制"等方面内容。

## 七. 消费者 (待写作)

分析消费者消息拉取的流程、Rebalance机制等方面内容。

## 八. 事务机制 (待写作)

补充分析Kafka的事务机制。

## 九. 流式计算 (待写作)

扣题。早期Kafka的slogan是"More than a mq"，那我们的就分析分析其流式计算方面的内容。
