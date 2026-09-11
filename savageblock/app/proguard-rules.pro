# kotlinx.serialization: keep generated serializers for our models.
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keepclassmembers class com.savageblock.app.data.** {
    *** Companion;
}
-keepclasseswithmembers class com.savageblock.app.data.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class com.savageblock.app.data.**$$serializer { *; }
