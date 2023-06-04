---
title: Kafka源码分析系列一：生产者
date: 2023-06-04 18:12:19
permalink: /high-performance/message-queue/kafka-source-code-research/producer/
categories:
  - high-performance
  - message-queue
  - kafka-source-code-research
tags:
  - 消息队列
---

# （1）Kafka源码分析系列-生产者

首先，以Java语言使用Kafka组件为例，列出一个Kakfa生产者的使用代码案例，如下：
```Java
import org.apache.kafka.clients.producer.*;
import org.apache.kafka.common.serialization.StringSerializer;

import java.util.Properties;
import java.util.concurrent.ExecutionException;

public class ProducerDemo {
    public static void main(String[] args) {
        boolean isAsync = args.length == 0 || !args[0].trim().equalsIgnoreCase("sync");

        Properties properties = new Properties();
        properties.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");
        properties.put(ProducerConfig.CLIENT_ID_CONFIG, "DemoProducer");
        properties.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
        properties.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());

        KafkaProducer<Integer, String> producer = new KafkaProducer<>(properties);
        String topic = "skytest";

        int messageNo = 1;
        while (true) {
            String messageStr = "Message_" + messageNo;
            long startTime = System.currentTimeMillis();
            if (isAsync) {
                // 异步
                producer.send(new ProducerRecord<>(topic, messageNo, messageStr),
                        new DemoCallBackV2(startTime, messageNo, messageStr));
            } else {
                // 同步
                try {
                    producer.send(new ProducerRecord<>(topic, messageNo, messageStr)).get();
                    System.out.println("Sent message:(" + messageNo + ", " + messageStr + ")");
                } catch (InterruptedException | ExecutionException e) {
                    e.printStackTrace();
                }
            }
            messageNo++;
        }
    }
}

class DemoCallBackV2 implements Callback {
    private final long startTime;
    private final int key;
    private final String message;

    public DemoCallBackV2(long startTime, int key, String message) {
        this.startTime = startTime;
        this.key = key;
        this.message = message;
    }

    /**
     * 消息发送成功metadata 不为Null，发送失败exception不为Null
     */
    @Override
    public void onCompletion(RecordMetadata metadata, Exception exception) {
        long elapsedTime = System.currentTimeMillis() - this.startTime;
        if (metadata != null) {
            System.out.println("message(" + key + ", " + message + ") send to partition (" + metadata.partition() + "),"
                    + "offset(" + metadata.offset() + ") in " + elapsedTime + " ms");
        } else {
            exception.printStackTrace();
        }
    }
}
```

从上面代码可以看出，生产者的代码和 `KafkaProducer` 类脱不了关系了。调用该类发送消息的全貌如下图所示，看看先：

![kafka-prodcuer-view.png](../../../.vuepress/public/png/kafka-prodcuer-view.png)

整个发送消息的过程是一个"生产者消费者模式"，主线程"生产"消息到消息累加器，Sender线程"消费"消息进行发送，为了就是批量发送，此外还方便压缩。
而消息在主线程执行过程中主要有3步：拦截器、序列化、分区。

## 1 拦截器-onSend
> 拦截器不是必要的功能，但是如果有需求对发送消息进行统一的修改等操作就变得有用，不需要用户单独再写业务逻辑。

ProducerInterceptor有三个方法，其中：
- onSend是在用户调用send方法之后，内部实际执行doSend方法之前执行。
- onAcknowledgement方法 是先于用户回调之前，对ACK响应进行处理
- close 拦截器被关闭时调用

![kafka-source-code-intercepter.png](../../../.vuepress/public/png/kafka-source-code-intercepter.png)

用户可以配置多个拦截器，多个拦截器将按照插入顺序形成拦截器链，值得注意的是拦截器发生异常抛出的异常会被忽略；此外，也要注意一种情况：如果某个拦截器依赖上一个拦截器的结果，但是当上一个拦截器异常，则该拦截器可能也不会正常工作，因为他接受到的是上一个成功返回的结果(可能是上上个)。

![kafka-source-code-intercepter2.png](../../../.vuepress/public/png/kafka-source-code-intercepter2.png)

下面开始执行doSend方法




