package rep2recall.db

import com.github.guepardoapps.kulid.ULID
import org.jetbrains.exposed.dao.Entity
import org.jetbrains.exposed.dao.EntityClass
import org.jetbrains.exposed.dao.id.EntityID
import java.security.SecureRandom
import java.util.*

object UserTable: IdInitTable<String>("user") {
    override val id = varchar("id", 26).entityId()

    val email = varchar("email", 100).uniqueIndex()
    val name = varchar("name", 100)
    val apiKey = varchar("api_key", 100)
}

class User(id: EntityID<String>): Entity<String>(id) {
    companion object: EntityClass<String, User>(UserTable) {
        override fun new(id: String?, init: User.() -> Unit): User {
            return super.new(id ?: ULID.random()) {
                apiKey = newApiKey()
                init()
            }
        }

        override fun new(init: User.() -> Unit) = new(null, init)

        fun create(
                email: String,
                name: String? = null,
                id: String? = null
        ): User {
            return new(id) {
                this.name = name ?: email.split('@')[0]
                this.email = email
            }
        }

        fun newApiKey(): String {
            val rand = SecureRandom()
            val ba = ByteArray(32)
            rand.nextBytes(ba)
            return String(Base64.getEncoder().encode(ba))
        }
    }

    var email by UserTable.email
    var name by UserTable.name
    var apiKey by UserTable.apiKey

    @Suppress("MemberVisibilityCanBePrivate")
    val notes by Note referrersOn NoteTable.userId
    @Suppress("MemberVisibilityCanBePrivate")
    val templates by Template referrersOn TemplateTable.userId
    @Suppress("MemberVisibilityCanBePrivate")
    val quizzes by Quiz referrersOn QuizTable.userId

    @Suppress("unused")
    fun purge() {
        notes.map { it.delete() }
        templates.map { it.delete() }
        quizzes.map { it.delete() }
        delete()
    }

    data class Ser(
            val id: String,
            val email: String,
            val name: String,
            val apiKey: String
    )

    @Suppress("unused")
    fun serialize() = Ser(
            id = id.value,
            email = email,
            name = name,
            apiKey = apiKey
    )
}