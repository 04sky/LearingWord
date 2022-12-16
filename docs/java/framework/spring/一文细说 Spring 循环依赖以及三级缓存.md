# 前言
在Spring中，是如何解决 __循环依赖__ 问题？答案是：`三级缓存`。那Spring是如何实现的？二级缓存为什么不行？一级缓存为什么不行？如何你太清楚，可以继续喽两眼



# 1 循环依赖问题

> 循环依赖: N个类循环（嵌套）引用，最终形成闭环。

![](https://files.mdnice.com/user/24438/0385bf6e-9232-415b-8f72-4bb52049698c.png)

如上图所示，A、B代表对象，虚线箭头代表引用关系。一旦循环引用问题，无限循环创建对象，就会导致栈溢出问题，即：StackOverflowError。



再举一个例子，我们在平时肯肯定看过下列的代码：
```Java
@Service
public class InstanceA {
  @Autowired
  private InstanceB b;

  public InstanceB getB() { return b; }
  public void setB(InstanceB b) { this.b = b;}
  public void func() { b.say(); }
}

@Service
public class InstanceB {
  @Autowired
  private InstanceA a;
  
  public InstanceA getA() { return a;}
  public void setA(InstanceA a) { this.a = a;}
  public void say() { System.out.println("hello"); }
}
```
InstanceA和 InstanceB相互引用，形成了循环依赖，但是 __运行并不报错__ ，这是因为Spring解决了这种循环依赖。下面，我们就通过源码看看Spring是如何解决的。



# 2 Spring解决循环依赖源码+图解

# 2.1 代码准备

代码目录结构如下：



红框里的InstanceA和InstanceB已在前面一节展示了。此外，为了充分测试，这里为InstanceA的func方法使用了AOP前置通知（不清楚实现原理，可参见 [Spring AOP 详细介绍](https://mp.weixin.qq.com/s?__biz=Mzg2NzcxNDE4NQ==&mid=2247483787&idx=1&sn=844cc637795bd8ffbf3fe297bdb53066&chksm=ceb6146df9c19d7ba56bb9bb80128da005c03e452d4a14cd6b69c843d3ce16305613e4bc81b2&token=1454536908&lang=zh_CN#rd) 一文）

切面类如下：

### MyAspect
```java
@Aspect
@Component
public class MyAspect {
  @Pointcut("execution(* com.sky.aop.three_cache.InstanceA.func(..)) ")
  public void test() {
  }
  @Before("test()")
  public void beforeTest(JoinPoint joinPoint) {
    System.out.println("前置通知 beforeTest");
  }
}
```

### AppConfig

```java
@Configuration
@ComponentScan("com.sky.aop.three_cache")
@EnableAspectJAutoProxy(proxyTargetClass = true) //开启Aspect切面代理
public class AppConfig {
  @Bean
  public InstanceA instanceA() {
    return new InstanceA();
  }
  @Bean
  public InstanceB instanceB() {
    return new InstanceB();
  }
}
```

### AopMain

```java
public class AopMain {
  public static void main(String[] args) {
    AnnotationConfigApplicationContext ac = new AnnotationConfigApplicationContext(AppConfig.class);
    InstanceA instanceA = (InstanceA) ac.getBean("instanceA");
    instanceA.func();
  }
}
```
## 2.2 解析源码
### 前面路程

1. 找到入口方法 `refresh`



从AopMain的这一行开始，找到refresh()方法，这是Spring生命周期的入口。


2. 进入refresh，找到`finishBeanFactoryInitialization`方法，实例化剩余的单例对象。

图

3. 进入finishBeanFactoryInitialization方法，找到`beanFactory.preInstantiateSingletons`方法

图

4. 在preInstantiateSingletons方法，使用for循环对bean进行创建，其中就包括instanceA和instanceB

图


接下来，我们跳过不关心的bean，直接运行到instanceA位置，接着就会走到`getBean(beanName)`


我们也终于开始进入instanceA的创建路程了！
### 创建instanceA的路程

1. 进入getBean(beanName)后进入doGetBean方法，找到重点 `getSingleton方法`


图

2. 进入getSingleton方法里面，我们获取“最终”对象和“中间”对象都是从这个方法中获取，从这个方法我们可以看到4个重要的集合。

图


我们在看下这4个map的定义方式，记住它们的名字！
```java
// 一级缓存 单例对象的缓存:  从beanName到bean实例。
private final Map<String, Object> singletonObjects = new ConcurrentHashMap<>(256);
// 二级缓存 早期单例对象的缓存:从beanName到bean实例。
private final Map<String, Object> earlySingletonObjects = new HashMap<>(16);
// 三级缓存 单例工厂的缓存:从beanName 到ObjectFactory。值是 ObjectFactory
private final Map<String, ObjectFactory<?>> singletonFactories = new HashMap<>(16);
// 当前正在创建的bean的名称。
private final Set<String> singletonsCurrentlyInCreation = Collections.newSetFromMap(new ConcurrentHashMap<>(16));
```
回到Spring的运行，此时从一级缓存中获取不到数据，且intanceA还未实例化，所在没在`“正在创建”池`中，因此这时会返回null。

3. 由于从缓存没获取到instanceA，因此现在去创建实例，走到`getSingleton`方法



图



4. 进入getSingleton方法，找到`beforeSingletonCreation(beanName)`，在单例创建前调用的方法。

图


5. 在`beforeSingletonCreation(beanName)`方法，就是将当前beanName也就是instanceA加入正在创建”池中。



图

6. 接着回到getSingleton方法中，执行到`singletonFactory.getObject()`方法，也就是执行刚才传入的lambda表达式。


图


7. 执行传入的lambda表达式，进入`createBean`方法，找到`doCreateBean`方法


图

8. 进入doCreateBean方法

图


这里在实例化instanceA后，调用`addSingletonFactory`。

9. 进入addSingletonFactory方法

图


这里实现将instanceA加入第三级缓存，可以看到是将传入的lambda表达式作为value存了下来。

此时，三级缓存状态图如下所示


图

10. 完成了instanceA的实例创建，接下来就要进行填充instanceB，找到populateBean方法


图


11. 进入populateBean方法，找到`ibp.postProcessProperties`方法

图



这里遍历了InstantiationAwareBeanPostProcessor类型的后置处理器，其中我们通过@Autowired注入instanceB，因此执行AutowiredAnnotationBeanPostProcessor的postProcessProperties方法，执行注入。

12. 进入postProcessProperties方法，找到`inject`方法，这里获取注入元数据，执行注入


图

13. 进入inject方法，这里遍历instanceA需要注入的元素，当然这里只有instanceB，继续`element.inject`方法

图


14. 进入inject方法，找到`beanFactory.resolveDependency`

图


15. 进入resolveDependency方法，找到`doResolveDependency`方法

图


16. 进入doResolveDependency方法，找到`resolveCandidate`方法

图


17. 进入resolveCandidate方法，找到`getBean`方法


图

终于到了熟悉的getBean方法，我们也正式开始了获取instacenB的路程。

### 创建instanceB的路程

1. 进入getBean方法，接着进入doGetBean方法，找到`getSingleton`方法

图



因为一级缓存中没有，且instanceB也不在“正在创建”池中，因此返回null。接着我们就得去创建instanceB。

2. 同样，再创建instanceB实例后，就将其放入第三级缓存

图


之后，三级缓存图就是如下样子：


3. 之后路程如同创建instanceA，不一样的是当instanceB去通过@Autowired注入instanceA调用到getSingleton时，`此时instanceA是在第三级缓存中，且处于“正在创建池”中的`，因此

图



这里会执行第三级缓存中存放的ObjectFactory，也就是`() -> getEarlyBeanReference(beanName, mbd, bean)`。

4. 进入getEarlyBeanReference

图


这里如果实例没有被代理，则直接返回原始对象；而这里instanceA被代理了，因此会返回`代理对象`！之后就将返回的对象instanceA代理对象`放入第二级缓存，删除第三级缓存`。

此时，三级缓存图如下：

图



5. instanceB收尾工作

图

instanceB获取到了instanceA的代理对象，完成了属性注入以及初始化后，也就是完成了创建instanceB，接着进行收尾工作。

图



也就是将instanceB从“正在创建”池中删除，并将instanceB加入第一级缓存。

图

6. 将instanceB加入第一级缓存


图


此时，三级缓存图如下：



图


7. instanceA收尾工作

instanceB填充完后，也就是代表instanceA的属性注入完成，因此接下面也会执行instaceA的初始化，之后执行instanceA的收尾工作。


图

也就是将`instanceA从“正在创建”池中删除，并将instanceA加入第一级缓存`。
至此，三级缓存图如下：

图



最后，`instanceA和instanceB均在第一级缓存`，后面直接从缓存中获取就可以得到。至此，Spring解决循环依赖问题结束。

图



## 执行过程小结

可以总结成下面的图

图


# 思考
## Spring中循环依赖有哪些场景
思考这个问题，因为面试要考，咳咳... just a joke。

其实Spring中循环依赖场景存在三类，分别是：

图


1. 构造器注入

因为Spring解决循环依赖问题，都是在实例化后但未初始化的处于中间状态的bean进行处理，而构造器是正在实例化，因此`构造器注入的循环依赖无法解决`。

2. field属性注入/setter方法注入

这种方式是我们平时最常用的方式，例如：@Autowired注解放在field上。这种方式能够解决，`Spring三级缓存解决就是这种场景的循环依赖`。

3. prototype 属性注入

这书field属性注入中一种特殊情形，每次都需要一个新的依赖对象，自然`不能通过三级缓存这种“缓存”方式解决`啦。

## 为什么不使用一级缓存

当使用一级缓存时，可以将`完整的bean`和`不完整的bean`放在同一个缓存来实现。

这种方式对于没有循环依赖的场景是可以，但是一旦有循环依赖出现，其他线程获取到不完整的bean，而且获取到的bean的属性都为null，自然就会出现空指针异常。

## 为什么不使用二级缓存

既然有上面的问题，那可以使用二级缓存，`第一级缓存放完整的bean，第二级缓存放不完整的bean`，不就可以解决循环依赖了？

是的，可以解决！但是，当存在动态代理对象时，还有需要进行生成代理对象这一层操作，就是前面讲的lambda表达式，而这个lambda表达式`每次调用会新生成一个代理对象`。若是第二级缓存放lambda表达式，就可能出现代理对象不是用一个的情况。

如上图所示，出现B和C注入的A对象不是同一个代理对象的情况。


