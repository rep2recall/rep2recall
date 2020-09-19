package rep2recall.db

import com.github.guepardoapps.kulid.ULID
import org.jetbrains.exposed.dao.Entity
import org.jetbrains.exposed.dao.EntityClass
import org.jetbrains.exposed.dao.id.EntityID
import java.util.*

object NoteTable: IdInitTable<String>() {
    override val id = varchar("id", 26).entityId()

    val userId = reference("user_id", UserTable)
}

class Note(id: EntityID<String>): Entity<String>(id) {
    companion object: EntityClass<String, Note>(NoteTable) {
        override fun new(id: String?, init: Note.() -> Unit) = super.new(id ?: ULID.random(), init)
        override fun new(init: Note.() -> Unit) = new(null, init)

        fun create(
                id: String? = null,
                user: User,
                attrs: SortedMap<String, String>
        ) {
            val n = new {
                userId = user.id
            }
            attrs.toList().map {
                NoteAttr.create(key = it.first, value = it.second, note = n)
            }
        }
    }

    val attrs by NoteAttr referrersOn NoteAttrTable.noteId

    var userId by NoteTable.userId
    val user by User referencedOn NoteTable.userId

    data class Ser(
            val id: String,
            val attrs: List<NoteAttr.Ser>,
            val userId: String
    )

    fun serialize() = Ser(
            id = id.value,
            attrs = attrs.map { it.serialize() },
            userId = userId.value
    )
}