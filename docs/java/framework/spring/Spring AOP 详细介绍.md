---
# 前言
以前从“八股文”文章里，仅了解到AOP的实现方式有CGLIB（继承）、JDK动态代理（接口）两种，那具体如何使用，Spring又是如何实现的呢？先这样，然后那样 - -..。

本篇文章分为3个部分：
- 基本知识：简介、使用方式、执行顺序
- 深入了解：AOP执行的详细过程
- 原理总结：概括AOP执行过程

# 1 AOP基本知识

## 1.1 简介
AOP实现将公共的代码像`切片`一样放入业务代码中。
（图）

优点：

  1. 降低模块耦合度
  2. 提高系统扩展性
  3. 提高代码复用性
  
## 1.2 一般使用过程


(1) 添加`@EnableAspectJAutoProxy`：
在 Spring 项目的配置类中添加,Springboot 项目不用，默认已配置好。

(2) 创建切面类（Aspect）：
 
 __定义切点__：`@Pointcut` 在哪些地方执行
 
 __通知方法__：
 - 前置通知（@Before）在目标方法执行之前执行
 - 后置通知（@After）在目标方法之后执行
 - 返回通知（@AfterReturning）在目标方法结束之前执行
 - 异常通知（@AfterThrowing）在目标方法出现异常后执行
 - 环绕通知（@Around）手动推进目标方法执行
 
 > 第2步中，务必需要@Aspect和@Component注解，前者表示该类为切面，后者使该类受IOC控制。


## 1.3 执行顺序小结

`单个切面`的场景执行顺序如下图所示，其中包括正常和异常两条路线。
图
`多个切面`场景下，执行顺序按照@Order数字越小，优先级越高执行。
图

# 2 AOP原理剖析
下面将按照代码执行顺序进行说明。

## 2.1 AOP起点
Aop原理从`@EnableAspectJAutoProxy`开始，先看一下该注解的定义：

```java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
/** 重要 */
@Import(AspectJAutoProxyRegistrar.class)
public @interface EnableAspectJAutoProxy {
  /** true：强制使用CGLIB实现动态代理*/
  boolean proxyTargetClass() default false;
  boolean exposeProxy() default false;
}
```
首先可以通过设置`proxyTargetClass`为true，实现强制使用CGLIB的目的。其次，@EnableAspectJAutoProxy最重要的是引入了`AspectJAutoProxyRegistrar`类，该类只有一个方法，如下所示：

```java
class AspectJAutoProxyRegistrar implements ImportBeanDefinitionRegistrar {

  @Override
  public void registerBeanDefinitions(
      AnnotationMetadata importingClassMetadata, BeanDefinitionRegistry registry) {
    /** 注册 AnnotationAwareAspectJAutoProxyCreator */
    AopConfigUtils.registerAspectJAnnotationAutoProxyCreatorIfNecessary(registry);
​
    AnnotationAttributes enableAspectJAutoProxy =
        AnnotationConfigUtils.attributesFor(importingClassMetadata, EnableAspectJAutoProxy.class);
    if (enableAspectJAutoProxy != null) {
      if (enableAspectJAutoProxy.getBoolean("proxyTargetClass")) {
        AopConfigUtils.forceAutoProxyCreatorToUseClassProxying(registry);
      }
      if (enableAspectJAutoProxy.getBoolean("exposeProxy")) {
        AopConfigUtils.forceAutoProxyCreatorToExposeProxy(registry);
      }
    }
  }
}
```
上图的 `registerBeanDefinitions`方法值得我们关心的是带注释的那一行，该行实现向IOC容器中注册 一个名为 `AnnotationAwareAspectJAutoProxyCreator` 的BeanDefinition。

> registerBeanDefinitions方法的执行时机是在构建IOC容器过程中的 “调用bean工厂后置处理器”时进行调用。

接下来，在继续深入之前，看下关键的 `AnnotationAwareAspectJAutoProxyCreator `的部分继承关系图。
图

从上图可以看出，`AnnotationAwareAspectJAutoProxyCreator`本质是个 __BeanPostProcessor__ ，从前面Spring生命周期的学习中可以得知，在初始化实例后，将会调用所有BeanPostProcessor的 __postProcessAfterInitialization__ 方法，而这里具体代码逻辑实现是在如下所示的父类`AbstractAutoProxyCreator`类中
```java
public abstract class AbstractAutoProxyCreator {
  ...
  @Override
  public Object postProcessAfterInitialization(@Nullable Object bean, String beanName) {
    if (bean != null) {
      Object cacheKey = getCacheKey(bean.getClass(), beanName);
      if (this.earlyProxyReferences.remove(cacheKey) != bean) {
        /** 包装bean */
        return wrapIfNecessary(bean, beanName, cacheKey);
      }
    }
    return bean;
  }
  
  protected Object wrapIfNecessary(Object bean, String beanName, Object cacheKey) {​
    Object[] specificInterceptors = getAdvicesAndAdvisorsForBean(bean.getClass(), 
          ​beanName, null);
    if (specificInterceptors != DO_NOT_PROXY) {
      this.advisedBeans.put(cacheKey, Boolean.TRUE);
      /** 将bean包装为proxy的主要方法 */
      Object proxy = createProxy(
          bean.getClass(), beanName, specificInterceptors, new SingletonTargetSource(bean));
      this.proxyTypes.put(cacheKey, proxy.getClass());
      return proxy;
    }
    this.advisedBeans.put(cacheKey, Boolean.FALSE);
    return bean;
  }
}
```
重点关注带注释的代码即可，`AbstractAutoProxyCreator`通过 __createProxy__ 方法创建了代理对象。继续深入createProxy方法

```java
protected Object createProxy (){
  /** 调用getProxy获取bean对应的proxy */
  // 创建动态代理  两种方式 JDK CGlib
  return proxyFactory.getProxy(getProxyClassLoader());
}

public Object getProxy(@Nullable ClassLoader classLoader) {
  return createAopProxy().getProxy(classLoader);
}
```
getProxy方法中，`createAopProxy()`代表选择动态代理实现方式，`getProxy()`是使用具体代理方式获取代理对象。其中，`createAopProxy()`最终会执行到 __createAopProxy__ 方法，如下：

```java
public AopProxy createAopProxy(AdvisedSupport config) throws AopConfigException {
  /** 1、
   * config.isOptimize() 是否使用优化的代理策略
   ​* config.isProxyTargetClass() 该值对应注解@EnableAspectJAutoProxy的参数proxyTargetClass
   * hasNoUserSuppliedProxyInterfaces(config) 是否存在代理接口
   * */
  if (config.isOptimize() || config.isProxyTargetClass() 
                          || hasNoUserSuppliedProxyInterfaces(config)) {
    Class<?> targetClass = config.getTargetClass();
    /** 如果目标类是接口或者是代理类，则直接使用JDKproxy */
    if (targetClass.isInterface() || Proxy.isProxyClass(targetClass)) {
      return new JdkDynamicAopProxy(config);
    }
    /** 其他情况使用CGLIBproxy */
    return new ObjenesisCglibAopProxy(config);
  }
  else {
    return new JdkDynamicAopProxy(config);
  }
}
```
可以看到，默认情况下待代理类有接口时则使用 __JDK动态代理__，其他情况使用 __CGLIB代理__。之后使用选择的代理方式创建代理对象，并将代理对象放入一级缓存`singletonObjects`中。之后我们从Spring中获取实例时获取的就是代理对象。
> 创建实例的原理简述：
java动态代理是利用反射机制生成一个实现代理接口的匿名类，在调用具体方法前调用InvokeHandler来处理。而cglib动态代理是利用asm开源包，对代理对象类的class文件加载进来，通过修改其字节码生成子类来处理。

最终，用户执行代理对象的方法，过程源码简化如下：
```java
调用被代理的方法() {
  保存上下文
  try {  
    try {
      Object retVal = {
        try {
          执行@Around中 p.proceed()之前的内容
          当执行p.proceed() {
            调用@Before指定的方法
          }
          执行@Around中 p.proceed()之后的内容
        } finally {
            调用@After指定的方法
        }
      };
      调用@AfterReturning指定的方法
      }
    } catch (Throwable ex) {
        调用@AfterThrowing指定的方法
        throw ex;
    }
  } finally {
     恢复上下文
  }
}
```
得知源码的执行过程，我们也能理解前面各个通知执行的顺序了。

# 3 要点总结

1. 通知执行顺序：@Around_before->@Before->Method->@Around_after->@AfterReturning
2. 强制使用CGLIB的方式：proxyTargetClass=true
3. 原理：通过注解@EnableAspectJAutoProxy最终注册了一个BeanPostProcessor，实现在bean初始化后创建代理对象进行替换。








