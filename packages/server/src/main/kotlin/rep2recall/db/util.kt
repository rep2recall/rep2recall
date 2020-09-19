package rep2recall.db

import org.jetbrains.exposed.dao.id.IdTable

abstract class IdInitTable<T: Comparable<T>>: IdTable<T>() {
    open fun init() {}
}

//abstract class InitTable(name: String = ""): Table(name) {
//    open fun init() {}
//}
