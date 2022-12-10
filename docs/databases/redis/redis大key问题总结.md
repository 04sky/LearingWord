# Redis 大Key问题
在实际场景或面试中，常会遇到Redis 大Key问题导致性能下降。

## 什么是Redis 大Key问题
大Key问题主要包含3种类型：

1. `value占用体积过大`：一般超过10KB算大；
2. `Filed过多`：例如在删除Hash接口时，时间复杂度为O(n)，耗时长；
2. `单个实例保存Key过多`：一般上亿个算大。

会导致：
1. `命令阻塞`：因为Redis是单线程，可能造成Redis用户或系统操作阻塞。
2. `影响IO`：单台实例网络带宽压力过大，传输数据多。
3. `节点内存不均/资源倾斜`：在集群模式下，可能出现节点内存不均匀，保存大Key的节点处理压力过大而导致速度下降甚至崩溃。

在Redis 4.0的异步删除之前，后台运行的key过期删除操作可能会出现执行缓慢，并且由于是系统操作在慢查询没有记录。

## 如何找到Redis大Key
1. 在redis-cli命令后添加--bigkeys。存在问题：只能获取各个类型的最大的大Key
2. 使用第三方工具。例如：使用Redistools工具包分析rdb文件。

## 解决方案
### 针对Value体积过大，采用拆分方案
#### 拆分Value
若Value为一个对象，可以拆成多个<key,value>结构，使用mget方法获取数据。

因为key不同，存储的分片就可能不一样，以此让原本单台Redis实例的压力分散到多个实例上。
#### 使用Hash存储
类似拆分Value方式，将Value对象使用Hash结构存储，使用hget/hmget获取指定field，使用hset/hmset设置。
### 针对Key数量过多，采用“聚合”方案
#### 使用Hash存储
当key之间存在联系时，例如同一个对象的属性，使用Hash的field代替原有的key。
#### 分桶存储
当key之间不存在联系时，将所有key分到多个桶里，每个桶形成一个Hash接口。每个Hash的field最好不超过512，100左右合适。

例如：1亿个key，按照每个Hash key有100field，则将分为100万个桶。更新或添加值是先算Hash得到key，然后在hmget(key,field),hset(key,field,value)

## 删除大Key
在Redis 4.0之前，不要直接删除，会阻塞命令，利用`scan`命令迭代大Key的元素，分批删除。
在Redis 4.0及之后，采用lazy free机制，使用unlink命令假删除大key，之后后台线程进行异步惰性删除。

