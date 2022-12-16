# 前言
在很多场景里需要`防止用户重复调用接口`，避免服务出现问题。为解决这个问题有很多方法，本文介绍一种存在于`后端使用redis防止重复调用逻辑`的实现方法。

本篇文章分为2个部分：

- 前置知识：redis set命令
- 实现方式：以签到接口为例实现防重复点击
# 前置知识
仅用到redis的set命令，忘记可以复习一下
> SET key value [EX seconds] [PX milliseconds] [NX|XX]

- `EX second` ：设置键的过期时间为 second 秒
- PX millisecond ：设置键的过期时间为 millisecond 毫秒
- `NX` ：只在键不存在时，才对键进行设置操作
- XX ：只在键已经存在时，才对键进行设置操作

# 实现方式

### 封装服务
首先封装一个缓存服务`cacheService`类或接口。该服务包含以下两个方法：
```java
// 加锁
public boolean simpleLock(String lockKey, int timeout) {
  String response = redisClient.set(lockKey, "1", "NX", "EX", timeout);
  if ("OK".equalsIgnoreCase(response)) {
    return true;
  }
  return false;
}

private static final int RETRY_TIMES = 3;
// 释放锁
public void simpleUnlock(String lockKey) {
  long flag = redisClient.del(lockKey);
  int retry = RETRY_TIMES;
  // 如果锁删除未成功重试
  if (flag < 0) {
    while (retry > 0) {
      flag = redisClient.del(lockKey);
      if (flag > 0) {
        break;
      }
      retry--;
    }
  }
}
```

### 签到接口防重复调用
```java
String key = "today_sign_lock_" + 时间 + 用户id；
boolean isNotSigned = cacheService.simpleLock(key, 60);
try {
  if (!isNotSigned) {
    throw new Exception("今天您已签到");
  }
  ...
} catch (Exception e) {
  throw new Exception("系统异常");
} finally {
  cacheService.simpleUnlock(key);
}
```

如此，用户一旦重复调用签到接口就会返回异常警告，而不会继续后面的签到逻辑。



